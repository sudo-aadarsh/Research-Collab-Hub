import requests

try:
    res = requests.post("http://localhost:8000/api/v1/auth/login", data={"username": "admin", "password": "password"})
    token = res.json()["access_token"]

    res2 = requests.get("http://localhost:8000/api/v1/papers/")
    paper_id = res2.json()["items"][0]["id"]

    res3 = requests.get(f"http://localhost:8000/api/v1/ai/recommend/venues/{paper_id}", headers={"Authorization": f"Bearer {token}"})
    print(res3.status_code)
    print(res3.text[:200])
except Exception as e:
    print(e)
