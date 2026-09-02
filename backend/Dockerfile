FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# Install Python dependencies. emergentintegrations is unused in production and
# requires a private index, so it is stripped from the requirements before install.
COPY requirements.txt .
RUN grep -v -i '^emergentintegrations' requirements.txt > requirements.prod.txt \
    && pip install --no-cache-dir -r requirements.prod.txt

COPY . .

EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
