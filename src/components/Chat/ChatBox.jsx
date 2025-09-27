import React, { useEffect, useState, useRef } from "react";
import {
  Card,
  Button,
  Input,
  List,
  Divider,
  Progress,
  message,
  Modal,
} from "antd";
import { useSelector, useDispatch } from "react-redux";
import { updateSession, initSession } from "../../redux/interviewSlice";
import { addOrUpdateCandidate } from "../../redux/candidateSlice";
import {
  generateQuestion,
  gradeAnswers,
  assistantPrompt,
} from "../../api/aiService";
import QuestionTimer from "./QuestionTimer";
import WelcomeBackModal from "../Welcome.jsx";
function getDifficultyByIndex(i) {
  if (i <= 1) return "easy";
  if (i <= 3) return "medium";
  return "hard";
}
function getTimerForDifficulty(diff) {
  if (diff === "easy") return 20;
  if (diff === "medium") return 60;
  return 120;
}
export default function ChatBox() {
  const dispatch = useDispatch();
  const candidates = useSelector((s) => s.candidates);
  const interview = useSelector((s) => s.interview);
  const activeId = interview.activeCandidateId || candidates[0]?.id || null;
  const sessionFromStore = interview.sessions[activeId] || {
    qas: [],
    questionIndex: 0,
    running: false,
    timer: 0,
    currentQuestion: null,
  };
  const [questionLoaded, setQuestionLoaded] = useState(false);
  const [localSession, setLocalSession] = useState(sessionFromStore);
  const [candidate, setCandidate] = useState(
    candidates.find((c) => c.id === activeId) || null
  );
  const [answer, setAnswer] = useState("");
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [redFlags, setRedFlags] = useState(0);
  const timerRef = useRef(null);
  const logRedFlag = (type) => {
    setRedFlags((prev) => {
      const newCount = prev + 1;
      alert(`Red flag detected: ${type}. Strike ${newCount} of 3.`);
      if (newCount >= 3) {
        handleInterviewStopAndReload();
      }
      return newCount;
    });
  };
  const handleInterviewStopAndReload = () => {
    message.error("Interview stopped due to 3 red flags. Score reset to 0.");
    setLocalSession({
      qas: [],
      questionIndex: 0,
      running: false,
      timer: 0,
      currentQuestion: null,
    });
    if (candidate) {
      const updatedCandidate = { ...candidate, qas: [], score: 0 };
      setCandidate(updatedCandidate);
      dispatch(addOrUpdateCandidate(updatedCandidate));
    }
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };
  useEffect(() => {
    const handleCopy = (e) => {
      e.preventDefault();
      logRedFlag("copy");
    };
    const handlePaste = (e) => {
      e.preventDefault();
      logRedFlag("paste");
    };
    const handleContextMenu = (e) => {
      e.preventDefault();
      logRedFlag("right-click");
    };
    const handleKeyDown = (e) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key))
      ) {
        e.preventDefault();
        logRedFlag("devtools");
      }
    };
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [localSession.running, candidate]);
  useEffect(() => {
    setCandidate(candidates.find((c) => c.id === activeId) || null);
    setLocalSession(sessionFromStore);
  }, [activeId, candidates, sessionFromStore]);
  const welcomeCheckedRef = useRef(false);
  useEffect(() => {
    if (!welcomeCheckedRef.current) {
      const sess = interview.sessions[activeId];
      if (sess && sess.qas && sess.qas.length > 0 && sess.qas.length < 6) {
        setWelcomeVisible(true);
      }
      welcomeCheckedRef.current = true;
    }
  }, [activeId, interview.sessions]);
  useEffect(() => {
    if (!activeId) return;
    dispatch(updateSession({ id: activeId, patch: localSession }));
    if (candidate) {
      const updatedCandidate = { ...candidate, qas: localSession.qas || [] };
      dispatch(addOrUpdateCandidate(updatedCandidate));
    }
  }, [localSession.qas]);
  useEffect(() => {
    if (!localSession.running || localSession.timer <= 0 || !questionLoaded)
      return;
    const interval = setInterval(() => {
      setLocalSession((s) => {
        if (s.timer <= 1) {
          clearInterval(interval);
          handleSubmit(true, answer);
          return { ...s, timer: 0 };
        }
        return { ...s, timer: s.timer - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [localSession.running, answer, questionLoaded]);
  async function collectMissingField(field) {
    const resp = await assistantPrompt(
      `We are missing candidate's ${field}. Please ask in a short friendly sentence for that field.`
    );
    return resp || `Please provide your ${field}`;
  }
  async function startInterview() {
    if (redFlags >= 3) {
      message.error("Cannot start interview: 3 red flags already recorded.");
      return;
    }
    if (!candidate) {
      message.error("Upload a resume first.");
      return;
    }
    const missing = [];
    if (!candidate.name) missing.push("name");
    if (!candidate.email) missing.push("email");
    if (!candidate.phone) missing.push("phone");
    if (missing.length > 0) {
      for (const f of missing) {
        const prompt = await collectMissingField(f);
        const reply = window.prompt(prompt + `\nEnter ${f}:`);
        if (!reply) {
          message.error(`${f} required.`);
          return;
        }
        const updated = { ...candidate, [f]: reply };
        dispatch(addOrUpdateCandidate(updated));
        setCandidate(updated);
      }
    }
    dispatch(initSession({ id: candidate.id }));
    const done = candidate.qas?.length || 0;
    setLocalSession((s) => ({
      ...s,
      qas: candidate.qas || [],
      questionIndex: done,
    }));
    if (done < 6) await loadQuestion(done);
    else message.info("Interview already completed.");
  }
  async function loadQuestion(index) {
    const difficulty = getDifficultyByIndex(index);
    setLocalSession((s) => ({
      ...s,
      running: true,
      currentQuestion: { loading: true },
      timer: getTimerForDifficulty(difficulty),
    }));
    setAnswer("");
    setQuestionLoaded(false);
    try {
      const resp = await generateQuestion(difficulty, index + 1);
      const q = {
        index,
        question: resp.question || resp,
        hints: resp.hints || [],
        rubric: resp.rubric || "",
      };
      setLocalSession((s) => ({
        ...s,
        currentQuestion: q,
        timer: getTimerForDifficulty(difficulty),
        running: true,
      }));
      setQuestionLoaded(true);
    } catch (e) {
      console.error(e);
      message.error("Failed to generate question.");
      setLocalSession((s) => ({
        ...s,
        running: false,
        currentQuestion: null,
        timer: 0,
      }));
    }
  }
  async function handleSubmit(auto = false, currentAnswer) {
    if (!candidate || !localSession.currentQuestion) return;
    const ans =
      currentAnswer !== undefined ? currentAnswer.trim() : answer.trim();
    const newQ = {
      index: localSession.questionIndex,
      question: localSession.currentQuestion.question,
      answer: ans,
      difficulty: getDifficultyByIndex(localSession.questionIndex),
      autoSubmitted: auto,
      timestamp: new Date().toISOString(),
    };
    const newQAs = [...(localSession.qas || []), newQ];
    const nextIndex = localSession.questionIndex + 1;
    setLocalSession((s) => ({
      ...s,
      qas: newQAs,
      currentQuestion: null,
      running: false,
      timer: 0,
      questionIndex: nextIndex,
    }));
    if (nextIndex < 6) {
      await loadQuestion(nextIndex);
    } else {
      await gradeAndFinishCandidate(newQAs);
    }
  }
  async function gradeAndFinishCandidate(qas) {
    message.loading({ content: "Grading answers...", key: "grading" });
    try {
      const grade = await gradeAnswers(
        {
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone,
        },
        qas
      );
      message.success({
        content: "Grading complete",
        key: "grading",
        duration: 2,
      });
      let score = grade?.TOTAL_SCORE ?? grade?.total_score ?? null;
      let summary = grade?.SUMMARY ?? grade?.summary ?? grade?.raw ?? "";
      const updatedCandidate = {
        ...candidate,
        qas,
        score,
        summary,
        completedAt: new Date().toISOString(),
      };
      dispatch(addOrUpdateCandidate(updatedCandidate));
      setCandidate(updatedCandidate);
      setLocalSession((s) => ({
        ...s,
        running: false,
        currentQuestion: null,
        timer: 0,
      }));
      Modal.info({
        title: "Interview Finished",
        content: `Candidate graded. Score: ${score ?? 0}`,
      });
    } catch (e) {
      console.error(e);
      message.error("Grading failed.");
    }
  }
  function resumeInterview() {
    setWelcomeVisible(false);
    const done = candidate.qas?.length || 0;
    setLocalSession((s) => ({
      ...s,
      qas: candidate.qas || [],
      questionIndex: done,
    }));
    if (done < 6) loadQuestion(done);
  }
  async function editCandidateDetails() {
    if (!candidate) return;
    const name = window.prompt("Enter candidate's name:", candidate.name || "");
    if (!name) return;
    const email = window.prompt(
      "Enter candidate's email:",
      candidate.email || ""
    );
    if (!email) return;
    const phone = window.prompt(
      "Enter candidate's phone:",
      candidate.phone || ""
    );
    if (!phone) return;
    const updated = { ...candidate, name, email, phone };
    setCandidate(updated);
    dispatch(addOrUpdateCandidate(updated));
    message.success("Candidate details updated");
  }
  return (
    <div className="chat-window">
      {!candidate ? (
        <Card>
          <p>No active candidate. Upload resume above to begin.</p>
        </Card>
      ) : (
        <>
          <Card>
            <div>
              <b>Candidate:</b> {candidate.name || "Unknown"}
            </div>
            <div>
              <b>Email:</b> {candidate.email || "—"}
            </div>
            <div>
              <b>Phone:</b> {candidate.phone || "—"}
            </div>
            <div style={{ marginTop: 8 }}>
              <Button
                type="primary"
                onClick={startInterview}
                disabled={
                  localSession.running ||
                  localSession.qas?.length > 0 ||
                  redFlags >= 3
                }
              >
                Start Interview
              </Button>
            </div>
          </Card>
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3>Interview</h3>
              <div>Progress: {localSession.qas?.length || 0} / 6</div>
            </div>
            <Divider />
            {localSession.currentQuestion ? (
              <>
                <div className="question">
                  Q{localSession.questionIndex + 1}:{" "}
                  {localSession.currentQuestion.question
                    ? localSession.currentQuestion.question
                    : "Question is getting generated..."}
                </div>
                <div style={{ marginTop: 6 }}>
                  <Progress
                    percent={Math.round(
                      ((localSession.questionIndex + 1) / 6) * 100
                    )}
                  />
                </div>
                <div style={{ marginTop: 8 }}>
                  {localSession.currentQuestion.question && (
                    <QuestionTimer
                      seconds={localSession.timer}
                      onTick={(sec) =>
                        setLocalSession((s) => ({ ...s, timer: sec }))
                      }
                    />
                  )}
                </div>
                <Input.TextArea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={6}
                  style={{ marginTop: 8 }}
                  placeholder="Type your answer..."
                />
                <div style={{ marginTop: 8 }}>
                  <Button type="primary" onClick={() => handleSubmit(false)}>
                    Submit Answer
                  </Button>
                </div>
              </>
            ) : (
              <div>
                <p>
                  No active question. Click <b>Start Interview</b> to begin or
                  resume.
                </p>
              </div>
            )}
            <Divider />
            <h4>Previous Answers</h4>
            <List
              dataSource={localSession.qas || []}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={`Q${item.index + 1} (${item.difficulty})`}
                    description={
                      <div>
                        <div style={{ fontWeight: 600 }}>{item.question}</div>
                        <div className="answer">{item.answer}</div>
                        <div style={{ fontSize: 12 }}>
                          Auto: {item.autoSubmitted ? "Yes" : "No"} —{" "}
                          {new Date(item.timestamp).toLocaleString()}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
          <WelcomeBackModal
            visible={welcomeVisible}
            onClose={() => setWelcomeVisible(false)}
            onResume={resumeInterview}
          />
        </>
      )}
    </div>
  );
}
