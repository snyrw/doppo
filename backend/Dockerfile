FROM pytorch/pytorch:2.12.0-cuda12.6-cudnn9-runtime

# HF will check this path first; volumes mount here for tl_xlarge endpoints.
# For tiers without a volume, HF falls back to /tmp download-on-demand.
ENV HF_HOME=/runpod-volume/huggingface-cache
ENV PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True

RUN pip install --no-cache-dir \
    "transformer-lens>=3.0" \
    "einops==0.8.1" \
    "fancy-einsum==0.0.3" \
    "jaxtyping==0.3.2" \
    "runpod" \
    "huggingface-hub" \
    "safetensors"

COPY worker/ /app/
WORKDIR /app

CMD ["python", "handler.py"]
