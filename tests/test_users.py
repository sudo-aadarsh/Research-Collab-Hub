"""
tests/test_users.py - Tests for auth and user management.
"""
import pytest


class TestAuth:
    def test_register_success(self, client):
        res = client.post("/api/v1/auth/register", json={
            "email":      "newuser@test.edu",
            "username":   "newuser",
            "password":   "SecurePass123!",
            "full_name":  "New User",
            "institution": "State University",
        })
        assert res.status_code == 201
        assert "user_id" in res.json()

    def test_register_duplicate_email(self, client, test_user):
        res = client.post("/api/v1/auth/register", json={
            "email":    "test@university.edu",
            "username": "other_name",
            "password": "SecurePass123!",
            "full_name": "Dup User",
        })
        assert res.status_code == 400
        assert "already registered" in res.json()["detail"]

    def test_login_success(self, client, test_user):
        res = client.post("/api/v1/auth/login",
            data={"username": "test@university.edu", "password": "TestPass123!"},
            headers={"Content-Type": "application/x-www-form-urlencoded"})
        assert res.status_code == 200
        data = res.json()
        assert "access_token"  in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client, test_user):
        res = client.post("/api/v1/auth/login",
            data={"username": "test@university.edu", "password": "wrongpass"},
            headers={"Content-Type": "application/x-www-form-urlencoded"})
        assert res.status_code == 401

    def test_protected_route_without_token(self, client):
        res = client.get("/api/v1/users/me")
        assert res.status_code == 401

    def test_protected_route_with_invalid_token(self, client):
        res = client.get("/api/v1/users/me",
            headers={"Authorization": "Bearer invalidtoken"})
        assert res.status_code == 401


class TestUserProfile:
    def test_get_own_profile(self, client, auth_headers, test_user):
        res = client.get("/api/v1/users/me", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["email"]     == test_user.email
        assert data["full_name"] == test_user.full_name
        assert "interests" in data
        assert "skills"    in data

    def test_update_profile(self, client, auth_headers):
        res = client.patch("/api/v1/users/me", headers=auth_headers, json={
            "bio": "AI researcher focused on NLP.",
            "orcid_id": "0000-0002-1825-0097",
        })
        assert res.status_code == 200

        # Verify change persisted
        profile = client.get("/api/v1/users/me", headers=auth_headers).json()
        assert profile["bio"]      == "AI researcher focused on NLP."
        assert profile["orcid_id"] == "0000-0002-1825-0097"

    def test_add_interest(self, client, auth_headers):
        res = client.post("/api/v1/users/me/interests", headers=auth_headers,
            json={"topic": "machine learning", "weight": 0.9})
        assert res.status_code == 201

        # Verify it appears in profile
        profile = client.get("/api/v1/users/me", headers=auth_headers).json()
        topics = [i["topic"] for i in profile["interests"]]
        assert "machine learning" in topics

    def test_remove_interest(self, client, auth_headers):
        # First add
        client.post("/api/v1/users/me/interests", headers=auth_headers,
            json={"topic": "to-remove", "weight": 0.5})
        # Then remove
        res = client.delete("/api/v1/users/me/interests/to-remove", headers=auth_headers)
        assert res.status_code == 200

        profile = client.get("/api/v1/users/me", headers=auth_headers).json()
        topics = [i["topic"] for i in profile["interests"]]
        assert "to-remove" not in topics

    def test_add_skill(self, client, auth_headers):
        res = client.post("/api/v1/users/me/skills", headers=auth_headers,
            json={"skill": "Python", "level": "expert"})
        assert res.status_code == 201

    def test_add_skill_invalid_level(self, client, auth_headers):
        res = client.post("/api/v1/users/me/skills", headers=auth_headers,
            json={"skill": "Python", "level": "master"})
        assert res.status_code == 422

    def test_list_users(self, client, auth_headers):
        res = client.get("/api/v1/users/", headers=auth_headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_get_public_profile(self, client, auth_headers, test_user):
        res = client.get(f"/api/v1/users/{test_user.id}", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert "email" not in data  # email not in public profile
        assert data["full_name"] == test_user.full_name

    def test_get_nonexistent_user(self, client, auth_headers):
        res = client.get("/api/v1/users/00000000-0000-0000-0000-000000000000",
            headers=auth_headers)
        assert res.status_code == 404
