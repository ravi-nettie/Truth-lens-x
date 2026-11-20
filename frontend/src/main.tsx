import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCKS === "true") {
    try {
      const { worker } = await import("./mocks/browser");
      const swUrl = `${import.meta.env.BASE_URL}mockServiceWorker.js`.replace(/\/\//g, "/");
      return await worker.start({
        serviceWorker: {
          url: swUrl,
        },
        onUnhandledRequest: "bypass",
      });
    } catch (err) {
      console.warn("MSW failed to start, falling back to client-side mode:", err);
    }
  }
}

// Always mount React app safely
enableMocking()
  .catch((err) => console.warn("Mocking initialization notice:", err))
  .finally(() => {
    const rootElement = document.getElementById("root");
    if (rootElement) {
      ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    }
  });

