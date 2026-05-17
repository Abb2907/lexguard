# LexGuard

**LexGuard** is an advanced AI Rights & Contract Intelligence platform designed to analyze legal documents, detect contradictions, extract key information, and provide expert-level insights using specialized AI agents.

## Overview

LexGuard streamlines legal intelligence by leveraging specialized LLM agents (powered by Groq and Llama 3) to process, analyze, and break down complex legal documents, contracts, and scenarios. The platform transitions from traditional rigid workflows into a multi-agent orchestrated system capable of robust analysis.

## Features

- **Multi-Agent Architecture**: Includes specialized agents such as:
  - **Analyst Agent**: Deep dives into document semantics and legal definitions.
  - **Contradiction Agent**: Identifies conflicting clauses, loopholes, and risks.
  - **Counsel Agent**: Provides tailored legal intelligence and risk-mitigation strategies.
  - **Extractor Agent**: Pulls out key entities, obligations, and dates.
  - **Scenario Agent**: Evaluates "what-if" scenarios based on contract conditions.
- **Lightning-Fast Inference**: Integrated with the Groq API for rapid processing via Llama 3 models.
- **RAG & Vector Storage**: Utilizes ChromaDB / Supabase for semantic search and retrieval-augmented generation.
- **Modern Interface**: A sleek, responsive frontend built with React and Vite.

## Tech Stack

- **Frontend**: React, Vite
- **Backend**: Python, FastAPI
- **AI/LLM**: Groq API (Llama 3)
- **Database / Vector Store**: ChromaDB, Supabase

## Getting Started

### Prerequisites

- Node.js & npm
- Python 3.9+
- Groq API Key

### Backend Setup

1. Navigate to the `backend` directory.
2. Set up a virtual environment and activate it:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the `.env.example` to `.env` and fill in your `GROQ_API_KEY`.
5. Run the backend server:
   ```bash
   uvicorn main:app --reload
   ```

### Frontend Setup

1. Navigate to the root directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## License

This project is licensed under the MIT License.
