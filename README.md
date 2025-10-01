# AI Interview Assistant

## Overview

AI Interview Assistant is a React-based web application designed to simulate real-time technical interviews. It features two synchronized tabs:

- **Interviewee (Chat)**: Allows candidates to upload resumes, answer AI-generated questions, and receive real-time feedback.
- **Interviewer (Dashboard)**: Enables interviewers to view candidate responses, scores, and summaries. (For testing purposes, use the interviewer access token: interviewer123.)

The application ensures data persistence, allowing users to resume sessions seamlessly.

## Features

- **Resume Upload**: Supports PDF and DOCX formats.
- **Field Extraction**: Automatically extracts Name, Email, and Phone from resumes; prompts candidates to provide missing information.
- **Timed Interview**: AI generates 6 questions (2 Easy, 2 Medium, 2 Hard) with timers: 20s, 60s, and 120s respectively.
- **Auto Submission**: Submits answers when time expires.
- **Final Score & Summary**: AI calculates a score and provides a brief summary post-interview.
- **Dual Tabs**:
  - **Interviewee Tab**: Chat interface for candidates.
  - **Interviewer Tab**: Dashboard displaying candidate list, scores, and summaries.
- **Anti-Cheating Measures**:
  - Copy/paste restrictions
  - Right-click disabled
  - Dev console detection and restrictions
- **Data Persistence**: Utilizes local storage to restore progress upon reopening, featuring a "Welcome Back" modal.

## Tech Stack

- **Frontend**: React, Vite
- **State Management**: Redux, redux-persist
- **UI Library**: Ant Design
- **Resume Parsing**: Custom utilities (`extractTextFromPDF`, `extractTextFromDocx`, `findNameEmailPhone`)
- **AI Integration**: Custom API integration (`generateQuestion`, `gradeAnswers`, `assistantPrompt`)

## Installation

Clone the repository:

```bash
git clone https://github.com/tanuku-saikarthik/AI-Interview-Assistant.git
cd AI-Interview-Assistant
```

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Access the application at `http://localhost:3000`.

## Deployment

The application is deployed on Vercel. Access the live demo here: [https://ai-interview-assistant-iota.vercel.app](https://ai-interview-assistant-iota.vercel.app)

## Usage

1. **Interviewee Tab**:
   - Upload a resume.
   - Provide any missing information as prompted.
   - Answer the AI-generated questions within the specified time limits.

2. **Interviewer Tab**:
   - View the list of candidates.
   - Click on a candidate to see their responses, scores, and summary.

## Data Persistence

The application uses `localStorage` to save interview progress. Upon reopening, the "Welcome Back" modal appears, allowing users to resume their session.

## Anti-Cheating Measures

- Copy/paste is disabled in the answer input area.
- Right-click is disabled throughout the interview interface.
- The application detects attempts to open developer console and restricts access during the interview.
## Acknowledgments

- Ant Design UI components
- Custom AI services and utilities
- Inspired by real-world technical interview requirements

