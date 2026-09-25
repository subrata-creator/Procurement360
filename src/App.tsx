import React, { useState } from "react";
import Header from "./components/Header";
import KpiBanner from "./components/KpiBanner";
import TaskInbox from "./components/TaskInbox";
import ActivityTimeline from "./components/ActivityTimeline";
import "../src/Styles/Styles.css";

const App: React.FC = () => {
  const [activeNavigation, setActiveNavigation] =
    useState("Dashboard");

  return (
    <div className="app">
      <Header
        activeItem={activeNavigation}
        onNavigate={setActiveNavigation}
      />

      <main className="dashboard">
        <KpiBanner />

        <div className="dashboard-content">
          <div className="task-area">
            <TaskInbox />
          </div>

          <ActivityTimeline />
        </div>
      </main>

      <button
        type="button"
        className="floating-chat"
        aria-label="Open assistant"
      >
        <svg
          width="30"
          height="30"
          viewBox="0 0 32 32"
          fill="none"
        >
          <path
            d="M7 7H25C26.657 7 28 8.343 28 10V21C28 22.657 26.657 24 25 24H16L10 28V24H7C5.343 24 4 22.657 4 21V10C4 8.343 5.343 7 7 7Z"
            stroke="white"
            strokeWidth="1.8"
          />

          <circle
            cx="12"
            cy="16"
            r="1.5"
            fill="white"
          />

          <circle
            cx="16"
            cy="16"
            r="1.5"
            fill="white"
          />

          <circle
            cx="20"
            cy="16"
            r="1.5"
            fill="white"
          />
        </svg>
      </button>
    </div>
  );
};

export default App;