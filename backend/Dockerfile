FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    # Cache HF/torch model downloads inside the image layer.
    HF_HOME=/app/.cache/huggingface

WORKDIR /app

COPY pyproject.toml ./
COPY app ./app

# CPU-only torch first (a few hundred MB instead of the ~2GB CUDA build), then
# the real ML stack — semantic embeddings + spaCy NLP. Without ".[ml]" the app
# silently falls back to keyword-only search, which defeats the point.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir -e ".[ml]"

# Bake the models into the image so the container starts fast and needs no
# network at runtime (no cold-start download).
RUN python -m spacy download en_core_web_sm \
 && python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY . .

EXPOSE 8000
# Railway/Render/Fly inject $PORT and route to it; bind it (default 8000 locally).
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
