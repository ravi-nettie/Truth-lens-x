import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";

// Pages
import { Landing } from "./pages/Landing";
import { NewCase } from "./pages/NewCase";
import { Dashboard } from "./pages/Dashboard";
import { Image } from "./pages/Image";
import { Video } from "./pages/Video";
import { Audio } from "./pages/Audio";
import { Text } from "./pages/Text";
import { Graph } from "./pages/Graph";
import { Timeline } from "./pages/Timeline";
import { Report } from "./pages/Report";
import { History } from "./pages/History";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/cases/new" element={<NewCase />} />
          <Route path="/cases/:id" element={<Dashboard />} />
          <Route path="/cases/:id/image" element={<Image />} />
          <Route path="/cases/:id/video" element={<Video />} />
          <Route path="/cases/:id/audio" element={<Audio />} />
          <Route path="/cases/:id/text" element={<Text />} />
          <Route path="/cases/:id/graph" element={<Graph />} />
          <Route path="/cases/:id/timeline" element={<Timeline />} />
          <Route path="/cases/:id/report" element={<Report />} />
          <Route path="/history" element={<History />} />
          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

export default App;
