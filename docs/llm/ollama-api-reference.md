# Ollama API Reference & Detailed Endpoint Specification

This document provides a comprehensive, production-grade guide to the **Ollama API**, covering all endpoints, parameters, request payloads, response schemas, and interactive code examples. 

Ollama is a lightweight, extensible framework for building and running large language models (LLMs) locally. It exposes a standard REST API that enables seamless integration into applications using any language, alongside official SDKs for Python and JavaScript.

---

## 1. Global Conventions & Setup

### Base URLs
*   **Local Deployment**: After installation, the Ollama API is served by default at:
    `http://localhost:11434/api`
*   **Cloud Models**: For running hosted models on Ollama, the base URL is:
    `https://ollama.com/api`

### Model Names
Ollama uses a `model:tag` format to uniquely identify models and their specific versions (quantization level, parameter size, etc.).
*   `model` can include an optional namespace (e.g., `namespace/model-name`).
*   The `tag` is optional and defaults to `latest` if omitted.
*   *Examples*: `llama3.2:latest`, `deepseek-r1:7b`, `codellama:34b-instruct-q4_K_M`.

### Durations
All durations and performance metrics returned by Ollama API endpoints are measured and returned in **nanoseconds (ns)**. To convert to seconds, divide by $10^9$.

### Streaming Responses
By default, generative endpoints (`/api/generate` and `/api/chat`) stream responses as a series of newline-delimited JSON objects.
*   To receive a single, consolidated JSON response instead, pass `"stream": false` in the request body.

---

## 2. API Endpoints Reference Matrix

| HTTP Method | Endpoint | Description | Streamable |
| :--- | :--- | :--- | :---: |
| **POST** | [`/api/generate`](#1-generate-a-completion-post-apigenerate) | Generate a completion for a given prompt | Yes |
| **POST** | [`/api/chat`](#2-generate-a-chat-completion-post-apichat) | Generate the next message in a multi-turn chat conversation | Yes |
| **POST** | [`/api/embed`](#3-generate-embeddings-post-apiembed) | Generate vector embeddings for text inputs | No |
| **GET** | [`/api/tags`](#4-list-local-models-get-apitags) | Retrieve all locally available models | No |
| **POST** | [`/api/show`](#5-show-model-information-post-apishow) | Fetch detailed configuration, Modelfile, parameters, and metadata | No |
| **POST** | [`/api/create`](#6-create-a-model-post-apicreate) | Build a new model from a Modelfile, GGUF, or Safetensors | Yes |
| **POST** | [`/api/copy`](#7-copy-a-model-post-apicopy) | Create a model with a new name from an existing model | No |
| **DELETE** | [`/api/delete`](#8-delete-a-model-delete-apidelete) | Delete a model and its associated data files | No |
| **POST** | [`/api/pull`](#9-pull-a-model-post-apipull) | Download a model from the Ollama library registry | Yes |
| **POST** | [`/api/push`](#10-push-a-model-post-apipush) | Upload a model to a model library registry | Yes |
| **GET** | [`/api/ps`](#11-list-running-models-get-apips) | List all models currently loaded into memory (VRAM/RAM) | No |
| **HEAD** | [`/api/blobs/:digest`](#12-check-if-a-blob-exists-head-apiblobsdigest) | Check if a specific file blob exists on the server | No |
| **POST** | [`/api/blobs/:digest`](#13-push-a-blob-post-apiblobsdigest) | Upload a file blob (e.g., GGUF, Safetensors) to the server | No |
| **GET** | [`/api/version`](#14-get-version-get-apiversion) | Retrieve the running Ollama server version | No |

---

## 3. Detailed Endpoint Specifications

### 1. Generate a Completion: `POST /api/generate`

Generates a response for a given text prompt. It can also accept images for multimodal models.

#### Request Parameters
*   `model` (*string*, required): Name of the model to use.
*   `prompt` (*string*, optional): Input prompt to generate a response from. If omitted, the model will be pre-loaded into memory.
*   `suffix` (*string*, optional): Suffix text that appears after the model response, used for fill-in-the-middle (code insertion) models.
*   `images` (*array of strings*, optional): Base64-encoded image strings (e.g., for `llava`).
*   `system` (*string*, optional): Overrides the default system prompt defined in the Modelfile.
*   `template` (*string*, optional): Overrides the default prompt template defined in the Modelfile.
*   `format` (*string* | *object*, optional): Restructures the output. Set to `"json"` for raw JSON mode, or provide a full **JSON Schema** object for structured outputs.
*   `stream` (*boolean*, optional, default: `true`): If `false`, returns a single JSON object instead of a stream of objects.
*   `raw` (*boolean*, optional, default: `false`): If `true`, bypasses the template processing entirely. Recommended if submitting a custom fully-templated prompt.
*   `keep_alive` (*string*, optional, default: `"5m"`): Controls how long the model remains loaded in memory after the request (e.g., `"10m"`, `"1h"`, `"0"` to unload immediately).
*   `think` (*boolean* | *string*, optional): For reasoning models (e.g., `deepseek-r1`), controls whether to return the raw thinking process. Can be `true`/`false` or levels: `"low"`, `"medium"`, `"high"`, `"max"`.
*   `options` (*object*, optional): Hyperparameters to override defaults. Key values:
    *   `temperature` (*float*): Control randomness (0.0 to 1.0).
    *   `seed` (*integer*): Set random seed for deterministic generation.
    *   `num_ctx` (*integer*): Size of the context window (e.g., `4096`, `8192`).
    *   `top_k` (*integer*): Limit vocabulary selection during sampling.
    *   `top_p` (*float*): Nucleus sampling threshold.
    *   `num_predict` (*integer*): Maximum number of tokens to generate.

#### Response Fields (Consolidated / Final Chunk)
*   `model` (*string*): The model name used.
*   `created_at` (*string*): UTC ISO 8601 timestamp of response generation.
*   `response` (*string*): Generated text (or empty in intermediate streaming blocks).
*   `thinking` (*string*, optional): The thinking output for reasoning models.
*   `done` (*boolean*): Indicates if generation has completed.
*   `done_reason` (*string*): Reason for termination (e.g., `"stop"`, `"length"`).
*   `context` (*array of integers*): Encoded conversational context representing history, which can be sent in the next request's `context` parameter to maintain short-term conversational state.
*   `total_duration` (*integer*): Total generation duration in nanoseconds.
*   `load_duration` (*integer*): Time spent loading the model into memory in nanoseconds.
*   `prompt_eval_count` (*integer*): Number of tokens in the prompt.
*   `prompt_eval_duration` (*integer*): Duration of prompt evaluation in nanoseconds.
*   `eval_count` (*integer*): Number of tokens in the generated response.
*   `eval_duration` (*integer*): Duration of response token generation in nanoseconds.

---

#### Examples

##### Streaming Request
```shell
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "Why is the sky blue?"
}'
```

##### Streaming Response Chunks
```json
{"model":"llama3.2","created_at":"2023-08-04T08:52:19.385406455-07:00","response":"The","done":false}
{"model":"llama3.2","created_at":"2023-08-04T08:52:19.485406455-07:00","response":" sky","done":false}
```

##### Final Streaming Response Chunk
```json
{
  "model": "llama3.2",
  "created_at": "2023-08-04T19:22:45.499127Z",
  "response": "",
  "done": true,
  "context": [1, 2, 3],
  "total_duration": 10706818083,
  "load_duration": 6338219291,
  "prompt_eval_count": 26,
  "prompt_eval_duration": 130079000,
  "eval_count": 259,
  "eval_duration": 4232710000
}
```

##### Non-Streaming Request
```shell
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "Why is the sky blue?",
  "stream": false
}'
```

##### Non-Streaming Response
```json
{
  "model": "llama3.2",
  "created_at": "2023-08-04T19:22:45.499127Z",
  "response": "The sky is blue because of Rayleigh scattering, where blue light is scattered in all directions by gases in Earth's atmosphere.",
  "done": true,
  "context": [1, 2, 3],
  "total_duration": 5043500667,
  "load_duration": 5025959,
  "prompt_eval_count": 26,
  "prompt_eval_duration": 325953000,
  "eval_count": 290,
  "eval_duration": 4709213000
}
```

##### Structured Outputs Request (JSON Schema)
```shell
curl -X POST http://localhost:11434/api/generate -H "Content-Type: application/json" -d '{
  "model": "llama3.1:8b",
  "prompt": "Ollama is 22 years old and is busy saving the world. Respond using JSON",
  "stream": false,
  "format": {
    "type": "object",
    "properties": {
      "age": { "type": "integer" },
      "available": { "type": "boolean" }
    },
    "required": [ "age", "available" ]
  }
}'
```

##### Structured Outputs Response
```json
{
  "model": "llama3.1:8b",
  "created_at": "2024-12-06T00:48:09.983619Z",
  "response": "{
  "age": 22,
  "available": true
}",
  "done": true,
  "done_reason": "stop",
  "context": [1, 2, 3],
  "total_duration": 1075509083,
  "load_duration": 567678166,
  "prompt_eval_count": 28,
  "prompt_eval_duration": 236000000,
  "eval_count": 16,
  "eval_duration": 269000000
}
```

##### Load a Model (Empty Prompt)
To load a model into GPU memory without generating text:
```shell
curl http://localhost:11434/api/generate -d '{ "model": "llama3.2" }'
```

##### Unload a Model (Empty Prompt, keep_alive: 0)
To free GPU memory and immediately unload a model:
```shell
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "keep_alive": 0
}'
```

---

### 2. Generate a Chat Completion: `POST /api/chat`

Generates the next message in a conversation. Designed for multi-turn dialogues and conversational memory.

#### Request Parameters
*   `model` (*string*, required): Name of the model.
*   `messages` (*array of objects*, required): Chat history as an array of message objects. Each message contains:
    *   `role` (*string*, required): `"system"`, `"user"`, `"assistant"`, or `"tool"`.
    *   `content` (*string*, required): Text content of the message.
    *   `images` (*array of strings*, optional): Base64-encoded image strings (for multimodal user inputs).
    *   `tool_calls` (*array of objects*, optional): List of tool/function calls generated by the assistant.
    *   `tool_name` (*string*, optional): Name of the tool being executed (used when submitting tool execution results with role `"tool"`).
*   `tools` (*array of objects*, optional): List of available function tools the model may invoke.
*   `format` (*string* | *object*, optional): Same as generate (JSON Schema or `"json"` string).
*   `stream` (*boolean*, optional, default: `true`): Stream toggle.
*   `keep_alive` (*string*, optional, default: `"5m"`): Time to keep model loaded.
*   `options` (*object*, optional): Runtime hyperparameter configuration.

#### Response Fields
*   `model` (*string*): The model name.
*   `created_at` (*string*): UTC ISO 8601 timestamp.
*   `message` (*object*): Generated response message.
    *   `role` (*string*): `"assistant"`.
    *   `content` (*string*): Generated text block.
    *   `thinking` (*string*, optional): Generated reasoning process (if reasoning model).
    *   `tool_calls` (*array of objects*, optional): Generated tool calls containing `function` with `name` and `arguments`.
*   `done` (*boolean*): Chat generation status.
*   `done_reason` (*string*): Why the model stopped generating.
*   `total_duration`, `load_duration`, `prompt_eval_count`, `prompt_eval_duration`, `eval_count`, `eval_duration` (*integers*): Standard timing metrics.

---

#### Examples

##### Streaming Chat Request
```shell
curl http://localhost:11434/api/chat -d '{
  "model": "llama3.2",
  "messages": [
    { "role": "user", "content": "why is the sky blue?" }
  ]
}'
```

##### Streaming Chat Response Chunks
```json
{"model":"llama3.2","created_at":"2023-08-04T08:52:19.385406455-07:00","message":{"role":"assistant","content":"The"},"done":false}
```

##### Final Chat Response Chunk
```json
{
  "model": "llama3.2",
  "created_at": "2023-08-04T19:22:45.499127Z",
  "message": { "role": "assistant", "content": "" },
  "done": true,
  "total_duration": 4883583458,
  "load_duration": 1334875,
  "prompt_eval_count": 26,
  "prompt_eval_duration": 342546000,
  "eval_count": 282,
  "eval_duration": 4535599000
}
```

##### Chat Request with Conversation History
```shell
curl http://localhost:11434/api/chat -d '{
  "model": "llama3.2",
  "messages": [
    { "role": "user", "content": "Why is the sky blue?" },
    { "role": "assistant", "content": "Due to Rayleigh scattering." },
    { "role": "user", "content": "How is that different than Mie scattering?" }
  ]
}'
```

##### Chat Request with Tools (Function Calling)
```shell
curl http://localhost:11434/api/chat -d '{
  "model": "llama3.2",
  "messages": [
    { "role": "user", "content": "What is the weather today in Paris?" }
  ],
  "stream": false,
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_current_weather",
        "description": "Get the current weather for a location",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "The location, e.g. Paris, FR"
            },
            "format": {
              "type": "string",
              "enum": ["celsius", "fahrenheit"],
              "description": "The format of temperature"
            }
          },
          "required": ["location", "format"]
        }
      }
    }
  ]
}'
```

##### Tool Calling Response
```json
{
  "model": "llama3.2",
  "created_at": "2024-07-22T20:33:28.123648Z",
  "message": {
    "role": "assistant",
    "content": "",
    "tool_calls": [
      {
        "type": "function",
        "function": {
          "name": "get_current_weather",
          "arguments": {
            "format": "celsius",
            "location": "Paris, FR"
          }
        }
      }
    ]
  },
  "done_reason": "stop",
  "done": true,
  "total_duration": 885095291,
  "load_duration": 3753500,
  "prompt_eval_count": 122,
  "prompt_eval_duration": 328493000,
  "eval_count": 33,
  "eval_duration": 552222000
}
```

##### Submitting Tool Execution Results
When your application executes the tool, submit the output back to Ollama to resume conversation:
```shell
curl http://localhost:11434/api/chat -d '{
  "model": "llama3.2",
  "messages": [
    { "role": "user", "content": "What is the weather today in Paris?" },
    {
      "role": "assistant",
      "content": "",
      "tool_calls": [
        {
          "function": {
            "name": "get_current_weather",
            "arguments": { "format": "celsius", "location": "Paris, FR" }
          }
        }
      ]
    },
    { "role": "tool", "content": "11 degrees celsius with light rain", "tool_name": "get_current_weather" }
  ],
  "stream": false
}'
```

---

### 3. Generate Embeddings: `POST /api/embed`

Generates high-dimensional vector representations representing text input.

#### Request Parameters
*   `model` (*string*, required): Name of model to generate embeddings from (e.g., `nomic-embed-text`, `all-minilm`).
*   `input` (*string* | *array of strings*, required): Input text or list of texts to generate embeddings for.
*   `truncate` (*boolean*, optional, default: `true`): Truncates inputs that exceed the context length limit. If set to `false`, throwing an error if context limit is exceeded.
*   `dimensions` (*integer*, optional): The desired vector dimension (only supported for specific models with flexible dimensionality, such as Matryoshka embeddings).
*   `keep_alive` (*string*, optional): Memory keep alive duration.
*   `options` (*object*, optional): Model options parameter override.

#### Response Fields
*   `model` (*string*): The exact model name.
*   `embeddings` (*array of arrays of floats*): Nested array of float values representing the high-dimensional vectors.
*   `total_duration` (*integer*): Execution duration in nanoseconds.
*   `load_duration` (*integer*): Load duration in nanoseconds.
*   `prompt_eval_count` (*integer*): Token count of input strings processed.

---

#### Examples

##### Request (Multiple Input)
```shell
curl http://localhost:11434/api/embed -d '{
  "model": "all-minilm",
  "input": ["Why is the sky blue?", "Why is the grass green?"]
}'
```

##### Response
```json
{
  "model": "all-minilm",
  "embeddings": [
    [ 0.010071029, -0.0017594862, 0.05007221, 0.04692972, 0.054916814 ],
    [ -0.0098027075, 0.06042469, 0.025257962, -0.006364387, 0.07272725 ]
  ],
  "total_duration": 14143917,
  "load_duration": 1019500,
  "prompt_eval_count": 16
}
```

---

### 4. List Local Models: `GET /api/tags`

Retrieves a detailed metadata inventory of all model tags currently downloaded and available on the local filesystem.

#### Response Fields
*   `models` (*array of objects*): Individual model instances.
    *   `name` (*string*): Public-facing model tag name.
    *   `model` (*string*): Primary base identifier.
    *   `modified_at` (*string*): ISO 8601 timestamp of last filesystem modification.
    *   `size` (*integer*): Total model disk space footprint in bytes.
    *   `digest` (*string*): Cryptographic SHA256 digest of the manifest.
    *   `details` (*object*): Technical specs of the architecture:
        *   `parent_model` (*string*): Base model reference if derivative.
        *   `format` (*string*): Underlying archive/model wrapper format (e.g., `"gguf"`).
        *   `family` (*string*): Base network architecture lineage (e.g., `"llama"`, `"qwen2"`).
        *   `families` (*array of strings*): Inherited model network structural components.
        *   `parameter_size` (*string*): Parameter scale indicator (e.g., `"8.0B"`).
        *   `quantization_level` (*string*): Quantization level applied (e.g., `"Q4_K_M"`).

---

#### Examples

##### Request
```shell
curl http://localhost:11434/api/tags
```

##### Response
```json
{
  "models": [
    {
      "name": "deepseek-r1:latest",
      "model": "deepseek-r1:latest",
      "modified_at": "2025-05-10T08:06:48.639712648-07:00",
      "size": 4683075271,
      "digest": "0a8c266910232fd3291e71e5ba1e058cc5af9d411192cf88b6d30e92b6e73163",
      "details": {
        "parent_model": "",
        "format": "gguf",
        "family": "qwen2",
        "families": ["qwen2"],
        "parameter_size": "7.6B",
        "quantization_level": "Q4_K_M"
      }
    }
  ]
}
```

---

### 5. Show Model Information: `POST /api/show`

Provides highly technical specifications for a given model, including parameter layouts, architecture key-value metadata, prompt templates, and the generated Modelfile.

#### Request Parameters
*   `model` (*string*, required): Name of target model.
*   `verbose` (*boolean*, optional): If `true`, populates heavy token arrays in `model_info` metadata fields.

---

#### Examples

##### Request
```shell
curl http://localhost:11434/api/show -d '{ "model": "llava" }'
```

##### Response
```json
{
  "modelfile": "# Modelfile generated by "ollama show"
# To build a new Modelfile based on this one, replace the FROM line with:
# FROM llava:latest

FROM /Users/matt/.ollama/models/blobs/sha256:200765e1283640ffbd013184bf496e261032fa75b99498a9613be4e94d63ad52
TEMPLATE """{{ .System }}
USER: {{ .Prompt }}
ASSISTANT: """
PARAMETER num_ctx 4096
PARAMETER stop "\u003c/s\u003e"
PARAMETER stop "USER:"
PARAMETER stop "ASSISTANT:"",
  "parameters": "num_keep 24
stop "<|start_header_id|>"
stop "<|end_header_id|>"
stop "<|eot_id|>"",
  "template": "{{ if .System }}<|start_header_id|>system<|end_header_id|>

{{ .System }}<|eot_id|>{{ end }}{{ if .Prompt }}<|start_header_id|>user<|end_header_id|>

{{ .Prompt }}<|eot_id|>{{ end }}<|start_header_id|>assistant<|end_header_id|>

{{ .Response }}<|eot_id|>",
  "details": {
    "parent_model": "",
    "format": "gguf",
    "family": "llama",
    "families": ["llama"],
    "parameter_size": "8.0B",
    "quantization_level": "Q4_0"
  },
  "model_info": {
    "general.architecture": "llama",
    "general.file_type": 2,
    "general.parameter_count": 8030261248,
    "general.quantization_version": 2,
    "llama.attention.head_count": 32,
    "llama.attention.head_count_kv": 8,
    "llama.block_count": 32,
    "llama.context_length": 8192,
    "llama.embedding_length": 4096,
    "llama.vocab_size": 128256
  },
  "capabilities": ["completion", "vision"]
}
```

---

### 6. Create a Model: `POST /api/create`

Creates a custom model based on a specified parent, GGUF file, or Safetensors directory.

#### Request Parameters
*   `model` (*string*, required): Name of the model to create.
*   `from` (*string*, optional): Name of an existing model to inherit layers and weights from.
*   `files` (*object*, optional): Dictionary mapping file paths to SHA256 digests of blobs pushed to the server (for GGUF/Safetensors creation).
*   `adapters` (*object*, optional): Dictionary of file names to digests of blobs representing LoRA adapter weights.
*   `template` (*string*, optional): Prompt template syntax override.
*   `license` (*string* | *array of strings*, optional): License documentation.
*   `system` (*string*, optional): Baseline system prompt parameters.
*   "stream" (*boolean*, optional, default: `true`): Progress output format indicator.
*   `quantize` (*string*, optional): Apply post-training quantization directly during conversion (e.g., `"q4_K_M"`, `"q8_0"`).

---

#### Examples

##### Request (Inheriting and setting custom instructions)
```shell
curl http://localhost:11434/api/create -d '{
  "model": "mario",
  "from": "llama3.2",
  "system": "You are Mario from Super Mario Bros. Speak exclusively as him."
}'
```

##### Streaming Response
```json
{"status":"reading model metadata"}
{"status":"creating system layer"}
{"status":"writing layer sha256:df30045fe90f0d750db82a058109cecd6d4de9c90a3d75b19c09e5f64580bb42"}
{"status":"writing manifest"}
{"status":"success"}
```

##### Request (Creating from a custom GGUF file)
Note: The GGUF file must be pushed first using `/api/blobs/:digest`.
```shell
curl http://localhost:11434/api/create -d '{
  "model": "my-custom-gguf",
  "files": {
    "model.gguf": "sha256:432f310a77f4650a88d0fd59ecdd7cebed8d684bafea53cbff0473542964f0c3"
  }
}'
```

---

### 7. Copy a Model: `POST /api/copy`

Creates a duplicate model under a new alias. Useful for tag renaming or backup generation.

#### Request Parameters
*   `source` (*string*, required): Name of target model to copy.
*   `destination` (*string*, required): Target alias to write.

---

#### Examples

##### Request
```shell
curl http://localhost:11434/api/copy -d '{
  "source": "llama3.2",
  "destination": "llama3.2-backup"
}'
```

##### Response
*   **Success**: `200 OK` (No response body).
*   **Failure**: `404 Not Found` if the source model does not exist.

---

### 8. Delete a Model: `DELETE /api/delete`

Physically purges a model manifest and all associated layer weights from disk.

#### Request Parameters
*   `model` (*string*, required): Name of the model to purge.

---

#### Examples

##### Request
```shell
curl -X DELETE http://localhost:11434/api/delete -d '{
  "model": "llama3.2-backup"
}'
```

##### Response
*   **Success**: `200 OK` (No response body).
*   **Failure**: `404 Not Found` if target model did not exist.

---

### 9. Pull a Model: `POST /api/pull`

Downloads a model from the official Ollama registry library. Pulls are resumeable automatically.

#### Request Parameters
*   `model` (*string*, required): Registry identifier (e.g., `"deepseek-r1"`).
*   `insecure` (*boolean*, optional): Skip certificate checks during pulling (dev environments only).
*   `stream` (*boolean*, optional, default: `true`): Stream toggle for tracking percentages.

---

#### Examples

##### Request
```shell
curl http://localhost:11434/api/pull -d '{ "model": "gemma2" }'
```

##### Streaming Progress Response
```json
{"status": "pulling manifest"}
{"status": "pulling digestname", "digest": "sha256:...", "total": 2142590208, "completed": 241970}
{"status": "verifying sha256 digest"}
{"status": "writing manifest"}
{"status": "success"}
```

---

### 10. Push a Model: `POST /api/push`

Uploads a model to a registry library. Requires first registering on ollama.com and creating local keys.

#### Request Parameters
*   `model` (*string*, required): Namespace/model mapping for destination (e.g., `"username/mario"`).
*   `insecure` (*boolean*, optional): Dev toggle.
*   `stream` (*boolean*, optional, default: `true`): Progress indicator stream.

---

#### Examples

##### Request
```shell
curl http://localhost:11434/api/push -d '{ "model": "mattw/mario:latest" }'
```

##### Response
```json
{"status": "retrieving manifest"}
{"status": "starting upload", "digest": "sha256:...", "total": 1928429856}
{"status": "pushing manifest"}
{"status": "success"}
```

---

### 11. List Running Models: `GET /api/ps`

Retrieves an active execution state tracking list of all models currently loaded into system VRAM or RAM.

#### Response Fields
*   `models` (*array of objects*): Loaded model metadata.
    *   `name` (*string*): Public model tag name.
    *   `model` (*string*): Identifier.
    *   `size` (*integer*): Physical VRAM/RAM loaded size in bytes.
    *   `digest` (*string*): Manifest signature hash.
    *   `details` (*object*): Architecture detail block.
    *   `expires_at` (*string*): ISO 8601 timestamp of when the model will automatically unload from memory due to inactivity (controlled by the `keep_alive` parameter).
    *   `size_vram` (*integer*): Size in bytes allocated in dedicated GPU memory (VRAM).
    *   `context_length` (*integer*): Context window size in tokens.

---

#### Examples

##### Request
```shell
curl http://localhost:11434/api/ps
```

##### Response
```json
{
  "models": [
    {
      "name": "gemma4:latest",
      "model": "gemma4:latest",
      "size": 6591830464,
      "digest": "c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb",
      "details": {
        "parent_model": "",
        "format": "gguf",
        "family": "gemma4",
        "families": ["gemma4"],
        "parameter_size": "8.0B",
        "quantization_level": "Q4_K_M"
      },
      "expires_at": "2025-10-17T16:47:07.93355-07:00",
      "size_vram": 5333539264,
      "context_length": 4096
    }
  ]
}
```

---

### 12. Check if a Blob Exists: `HEAD /api/blobs/:digest`

Used in direct model creation to inspect if a specific file blob matches the server's cache.

#### Path Parameters
*   `digest` (*string*, required): Target file SHA256 digest string.

---

#### Examples

##### Request
```shell
curl -I http://localhost:11434/api/blobs/sha256:29fdb92e57cf0827ded04ae6461b5931d01fa595843f55d36f5b275a52087dd2
```

##### Response
*   `200 OK` (Blob exists on local server cache).
*   `404 Not Found` (Blob needs to be uploaded first using `POST /api/blobs/:digest`).

---

### 13. Push a Blob: `POST /api/blobs/:digest`

Uploads a direct file segment block (like GGUF files) to server cache directory.

#### Path Parameters
*   `digest` (*string*, required): Target SHA256 digest payload file mapping.

---

#### Examples

##### Request
```shell
curl -T model.gguf -X POST http://localhost:11434/api/blobs/sha256:29fdb92e57cf0827ded04ae6461b5931d01fa595843f55d36f5b275a52087dd2
```

##### Response
*   `201 Created` (Success).
*   `400 Bad Request` if payload digest checksum verification does not align.

---

### 14. Get Version: `GET /api/version`

Retrieves the current software release version tag of the running Ollama engine server.

---

#### Examples

##### Request
```shell
curl http://localhost:11434/api/version
```

##### Response
```json
{
  "version": "0.5.7"
}
```

---

## 4. API Error Handling

The Ollama API uses standard HTTP status codes to communicate request results:

*   **200 OK**: The request completed successfully.
*   **201 Created**: A resource (blob) was created successfully.
*   **400 Bad Request**: Invalid parameters or payload formatting.
*   **404 Not Found**: The requested model, file, or blob does not exist.
*   **500 Internal Server Error**: Issues on the engine side, such as failure to allocate VRAM.

---

## 5. Official Language Libraries

In addition to interacting with the REST API directly using HTTP/cURL, developers can leverage official libraries for simplified integration.

### Python SDK
Install via pip:
```shell
pip install ollama
```

Basic Chat completion example:
```python
import ollama

response = ollama.chat(
    model="llama3.2",
    messages=[
        {"role": "user", "content": "Why is the sky blue?"}
    ]
)
print(response['message']['content'])
```

### JavaScript SDK
Install via npm:
```shell
npm install ollama
```

Basic Chat completion example:
```javascript
import ollama from 'ollama';

const response = await ollama.chat({
  model: 'llama3.2',
  messages: [{ role: 'user', content: 'Why is the sky blue?' }],
});
console.log(response.message.content);
```
