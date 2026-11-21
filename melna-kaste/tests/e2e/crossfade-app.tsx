import { useState } from "react";
import { createRoot } from "react-dom/client";
import { TvPicture } from "../../src/components/tv-picture";

const clips = ["./clips/red.mp4", "./clips/gold.mp4", "./clips/blue.mp4"];

function App() {
  const [index, setIndex] = useState(0);
  const url = clips[index];
  const preloadUrls = [clips[(index + 1) % clips.length], clips[(index + 2) % clips.length]];
  return (
    <div className="picture" data-index={index}>
      <TvPicture
        url={url}
        nextUrl={preloadUrls[0]}
        preloadUrls={preloadUrls}
        loop={false}
        muted={true}
        cycleId="cycle"
        clipToken={`clip-${index}`}
        armed={true}
        onEnded={() => setIndex((current) => (current + 1) % clips.length)}
        onFailed={() => setIndex((current) => (current + 1) % clips.length)}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
