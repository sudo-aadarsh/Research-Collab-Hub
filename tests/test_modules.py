"""
tests/test_papers.py - Tests for Papers module.
"""
import pytest


@pytest.fixture
def paper(client, auth_headers):
    """Create a test paper and return its data."""
    res = client.post("/api/v1/papers/", headers=auth_headers, json={
        "title":    "Test Paper: Deep Learning for Knowledge Extraction",
        "abstract": "This paper presents a novel approach to knowledge extraction "
                    "using transformer-based deep learning models. We demonstrate "
                    "significant improvements over baseline methods.",
        "keywords": ["deep learning", "knowledge extraction", "transformers"],
    })
    assert res.status_code == 201
    return res.json()


class TestPapersCRUD:
    def test_create_paper(self, client, auth_headers):
        res = client.post("/api/v1/papers/", headers=auth_headers, json={
            "title":    "A Survey of LLM Alignment Techniques",
            "abstract": "We survey recent approaches to aligning large language models.",
            "keywords": ["llm", "alignment", "rlhf"],
        })
        assert res.status_code == 201
        data = res.json()
        assert data["title"]   == "A Survey of LLM Alignment Techniques"
        assert data["status"]  == "draft"
        assert data["version"] == 1
        assert len(data["authors"]) == 1
        assert data["authors"][0]["is_corresponding"] is True

    def test_list_papers(self, client, auth_headers, paper):
        res = client.get("/api/v1/papers/", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert "total" in data
        assert "items" in data
        assert data["total"] >= 1

    def test_search_papers(self, client, auth_headers, paper):
        res = client.get("/api/v1/papers/?search=knowledge+extraction", headers=auth_headers)
        assert res.status_code == 200
        items = res.json()["items"]
        assert any("knowledge" in p["title"].lower() for p in items)

    def test_filter_by_status(self, client, auth_headers, paper):
        res = client.get("/api/v1/papers/?status=draft", headers=auth_headers)
        assert res.status_code == 200
        for p in res.json()["items"]:
            assert p["status"] == "draft"

    def test_get_paper_detail(self, client, auth_headers, paper):
        res = client.get(f"/api/v1/papers/{paper['id']}", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["id"]    == paper["id"]
        assert "authors"     in data
        assert "keywords"    in data

    def test_update_paper(self, client, auth_headers, paper):
        res = client.patch(f"/api/v1/papers/{paper['id']}", headers=auth_headers, json={
            "abstract": "Updated abstract with more detail about our methodology.",
            "word_count": 8500,
        })
        assert res.status_code == 200
        data = res.json()
        assert "Updated abstract" in data["abstract"]
        assert data["word_count"] == 8500

    def test_update_status(self, client, auth_headers, paper):
        res = client.patch(f"/api/v1/papers/{paper['id']}/status",
            headers=auth_headers,
            json={"status": "in_review"})
        assert res.status_code == 200

        updated = client.get(f"/api/v1/papers/{paper['id']}", headers=auth_headers).json()
        assert updated["status"] == "in_review"

    def test_invalid_status_value(self, client, auth_headers, paper):
        res = client.patch(f"/api/v1/papers/{paper['id']}/status",
            headers=auth_headers,
            json={"status": "awaiting_magic"})
        assert res.status_code == 422

    def test_delete_paper(self, client, auth_headers):
        # Create and immediately delete
        created = client.post("/api/v1/papers/", headers=auth_headers, json={
            "title": "Paper to Delete"
        }).json()
        res = client.delete(f"/api/v1/papers/{created['id']}", headers=auth_headers)
        assert res.status_code == 204
        # Verify gone
        assert client.get(f"/api/v1/papers/{created['id']}", headers=auth_headers).status_code == 404

    def test_get_versions(self, client, auth_headers, paper):
        res = client.get(f"/api/v1/papers/{paper['id']}/versions", headers=auth_headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_get_nonexistent_paper(self, client, auth_headers):
        res = client.get("/api/v1/papers/00000000-0000-0000-0000-000000000000",
            headers=auth_headers)
        assert res.status_code == 404


class TestPaperAuthors:
    def test_add_external_author(self, client, auth_headers, paper):
        res = client.post(f"/api/v1/papers/{paper['id']}/authors",
            headers=auth_headers,
            json={
                "author_name":  "Prof. External Collaborator",
                "author_email": "ext@otheru.edu",
                "order_index":  1,
            })
        assert res.status_code == 201

    def test_author_ordering(self, client, auth_headers, paper):
        """Authors should be returned in order_index order."""
        detail = client.get(f"/api/v1/papers/{paper['id']}", headers=auth_headers).json()
        orders = [a["order_index"] for a in detail["authors"]]
        assert orders == sorted(orders)


"""
tests/test_projects.py - Tests for Projects module.
"""

@pytest.fixture
def project(client, auth_headers):
    res = client.post("/api/v1/projects/", headers=auth_headers, json={
        "title":       "Federated Learning Research",
        "description": "Research on privacy-preserving ML.",
        "tags":        ["federated", "privacy", "ml"],
        "is_public":   True,
    })
    assert res.status_code == 201
    return res.json()


class TestProjectsCRUD:
    def test_create_project(self, client, auth_headers):
        res = client.post("/api/v1/projects/", headers=auth_headers, json={
            "title": "NLP for Scientific Literature",
            "tags":  ["nlp", "scientometrics"],
        })
        assert res.status_code == 201
        data = res.json()
        assert data["status"]       == "planning"
        assert data["member_count"] == 1   # owner auto-added

    def test_list_projects(self, client, auth_headers, project):
        res = client.get("/api/v1/projects/", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["total"] >= 1

    def test_get_project_detail(self, client, auth_headers, project):
        res = client.get(f"/api/v1/projects/{project['id']}", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert "members"    in data
        assert "milestones" in data

    def test_update_project(self, client, auth_headers, project):
        res = client.patch(f"/api/v1/projects/{project['id']}",
            headers=auth_headers,
            json={"status": "active", "description": "Updated description."})
        assert res.status_code == 200
        assert res.json()["status"] == "active"

    def test_add_milestone(self, client, auth_headers, project):
        res = client.post(f"/api/v1/projects/{project['id']}/milestones",
            headers=auth_headers,
            json={"title": "Complete literature review", "due_date": "2025-06-30"})
        assert res.status_code == 201
        assert "id" in res.json()

    def test_complete_milestone(self, client, auth_headers, project):
        ms = client.post(f"/api/v1/projects/{project['id']}/milestones",
            headers=auth_headers,
            json={"title": "Draft paper"}).json()

        res = client.patch(
            f"/api/v1/projects/{project['id']}/milestones/{ms['id']}/complete",
            headers=auth_headers)
        assert res.status_code == 200

        # Verify progress updated
        updated = client.get(f"/api/v1/projects/{project['id']}", headers=auth_headers).json()
        assert updated["milestone_completed"] >= 1

    def test_delete_project(self, client, auth_headers):
        created = client.post("/api/v1/projects/", headers=auth_headers, json={
            "title": "To Delete"
        }).json()
        res = client.delete(f"/api/v1/projects/{created['id']}", headers=auth_headers)
        assert res.status_code == 204


"""
tests/test_references.py - Tests for References module.
"""

@pytest.fixture
def reference(client, auth_headers):
    res = client.post("/api/v1/references", headers=auth_headers, json={
        "title":      "Attention Is All You Need",
        "authors":    ["Vaswani, A.", "Shazeer, N.", "Parmar, N."],
        "year":       2017,
        "doi":        "10.48550/arXiv.1706.03762",
        "journal":    "NeurIPS",
        "abstract":   "The dominant sequence transduction models are based on complex recurrent...",
        "tags":       ["transformers", "attention", "nlp"],
    })
    assert res.status_code == 201
    return res.json()


class TestReferences:
    def test_create_reference(self, client, auth_headers):
        res = client.post("/api/v1/references", headers=auth_headers, json={
            "title":   "BERT: Pre-training of Deep Bidirectional Transformers",
            "authors": ["Devlin, J.", "Chang, M."],
            "year":    2019,
            "tags":    ["bert", "nlp", "pretraining"],
        })
        assert res.status_code == 201
        data = res.json()
        # BibTeX key auto-generated
        assert data["citation_key"] is not None

    def test_list_references(self, client, auth_headers, reference):
        res = client.get("/api/v1/references", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["total"] >= 1

    def test_search_references(self, client, auth_headers, reference):
        res = client.get("/api/v1/references?search=Attention", headers=auth_headers)
        assert res.status_code == 200
        items = res.json()["items"]
        assert any("Attention" in r["title"] for r in items)

    def test_export_bibtex(self, client, auth_headers, reference):
        res = client.get(f"/api/v1/references/{reference['id']}/bibtex",
            headers=auth_headers)
        assert res.status_code == 200
        bibtex = res.json()["bibtex"]
        assert "@article" in bibtex or "@inproceedings" in bibtex
        assert "Attention Is All You Need" in bibtex
        assert "Vaswani" in bibtex

    def test_link_reference_to_paper(self, client, auth_headers, reference):
        # Create paper first
        paper = client.post("/api/v1/papers/", headers=auth_headers, json={
            "title": "Paper Citing Vaswani"
        }).json()

        res = client.post(
            f"/api/v1/papers/{paper['id']}/references/{reference['id']}",
            headers=auth_headers,
            json={"context": "Used in the transformer baseline comparison."})
        assert res.status_code == 201

        # Verify link
        refs = client.get(
            f"/api/v1/papers/{paper['id']}/references",
            headers=auth_headers).json()
        assert any(r["id"] == reference["id"] for r in refs)

    def test_bibtex_export_paper(self, client, auth_headers, reference):
        paper = client.post("/api/v1/papers/", headers=auth_headers, json={
            "title": "Paper for BibTeX export"
        }).json()
        client.post(
            f"/api/v1/papers/{paper['id']}/references/{reference['id']}",
            headers=auth_headers, json={})
        res = client.get(
            f"/api/v1/papers/{paper['id']}/references/export/bibtex",
            headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["count"] == 1
        assert "Vaswani" in res.json()["bibtex"]


"""
tests/test_collaborations.py - Tests for Collaborations module.
"""

@pytest.fixture
def second_user(client):
    client.post("/api/v1/auth/register", json={
        "email": "second@uni.edu", "username": "seconduser",
        "password": "TestPass123!", "full_name": "Dr. Second User",
        "institution": "Second University",
    })
    res = client.post("/api/v1/auth/login",
        data={"username": "second@uni.edu", "password": "TestPass123!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    return res.json()


class TestCollaborations:
    def test_send_request(self, client, auth_headers, second_user):
        res = client.post("/api/v1/collaborations/requests",
            headers=auth_headers,
            json={
                "target_id": second_user["user_id"],
                "message":   "Hi! I think our research interests align well.",
            })
        assert res.status_code == 201
        assert "id" in res.json()

    def test_cannot_self_request(self, client, auth_headers, test_user):
        res = client.post("/api/v1/collaborations/requests",
            headers=auth_headers,
            json={"target_id": str(test_user.id)})
        assert res.status_code == 400

    def test_duplicate_request_rejected(self, client, auth_headers, second_user):
        payload = {"target_id": second_user["user_id"], "message": "Again!"}
        client.post("/api/v1/collaborations/requests",
            headers=auth_headers, json=payload)
        res = client.post("/api/v1/collaborations/requests",
            headers=auth_headers, json=payload)
        assert res.status_code == 409

    def test_get_outgoing(self, client, auth_headers, second_user):
        res = client.get("/api/v1/collaborations/requests/outgoing", headers=auth_headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_accept_request(self, client, auth_headers, second_user):
        # Send from main user to second
        req = client.post("/api/v1/collaborations/requests",
            headers={"Authorization": f"Bearer {second_user['access_token']}"},
            json={"target_id": str(
                client.get("/api/v1/users/me", headers=auth_headers).json()["id"]
            )}).json()

        # Accept as main user
        res = client.patch(
            f"/api/v1/collaborations/requests/{req['id']}/respond",
            headers=auth_headers,
            json={"status": "accepted"})
        assert res.status_code == 200

    def test_invalid_response_status(self, client, auth_headers, second_user):
        req = client.post("/api/v1/collaborations/requests",
            headers={"Authorization": f"Bearer {second_user['access_token']}"},
            json={"target_id":
                client.get("/api/v1/users/me", headers=auth_headers).json()["id"]
            }).json()
        res = client.patch(
            f"/api/v1/collaborations/requests/{req['id']}/respond",
            headers=auth_headers,
            json={"status": "maybe"})
        assert res.status_code == 400
