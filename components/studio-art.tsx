"use client";
import { useState } from "react";
import Image from "next/image";
export function PenMark() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M8 39 15 17 36 7 41 12 30 33 8 39Zm0 0 16-16m-9-6 15 16"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="25" cy="22" r="3" fill="currentColor" />
    </svg>
  );
}
export function Flourish({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 180 100"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 78C27 40 42 18 64 24c26 8 9 57-15 48-21-8 0-41 35-34 27 5 43 27 75 12m-15-9 16 9-15 12M104 7l3 12m12-7-10 8M97 16l9 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
const filmFrames = [
  "/film-frames/stand-for-justice.webp",
  "/film-frames/do-not-ridicule.webp",
  "/film-frames/hearts-that-see.webp",
  "/film-frames/through-their-doors.webp",
  "/film-frames/for-those-who-understand.webp",
];
type ReelProps = {
  label: string;
  previous: string;
  next: string;
  demo: string;
  alt: string;
  titles: string[];
};
export function StudioReel(p: ReelProps) {
  const [active, setActive] = useState(0);
  const previous = (active + filmFrames.length - 1) % filmFrames.length;
  const next = (active + 1) % filmFrames.length;
  return (
    <div className="art-composition film-composition">
      <div className="art-note" aria-hidden="true">
        <Flourish />
        {p.label}
      </div>
      <div className="film-side film-side-left" aria-hidden="true">
        <Image
          src={filmFrames[previous]}
          alt=""
          width={540}
          height={960}
          sizes="180px"
        />
      </div>
      <div className="film-side film-side-right" aria-hidden="true">
        <Image
          src={filmFrames[next]}
          alt=""
          width={540}
          height={960}
          sizes="180px"
        />
      </div>
      <div className="reel-paper film-paper">
        <div className="tape" aria-hidden="true" />
        <div className="reel-topline">
          <span>QALAM MOTION</span>
          <span>0{active + 1} / 05</span>
        </div>
        <div className="reel-image film-frame">
          <Image
            key={filmFrames[active]}
            src={filmFrames[active]}
            alt={`${p.alt} — ${p.titles[active]}`}
            width={540}
            height={960}
            sizes="(max-width: 620px) 230px, 270px"
            loading="eager"
          />
        </div>
        <div className="frame-controls">
          <button
            type="button"
            onClick={() => setActive(previous)}
            aria-label={p.previous}
          >
            <span aria-hidden="true">←</span>
          </button>
          <p className="frame-title" aria-live="polite">
            {p.titles[active]}
          </p>
          <button
            type="button"
            onClick={() => setActive(next)}
            aria-label={p.next}
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <div className="frame-dots" role="group" aria-label={p.label}>
        {filmFrames.map((src, i) => (
          <button
            key={src}
            type="button"
            aria-label={p.titles[i]}
            aria-pressed={i === active}
            onClick={() => setActive(i)}
          >
            <span />
          </button>
        ))}
      </div>
      <div className="art-footnote">✳ &nbsp; {p.demo}</div>
    </div>
  );
}
type CraftProps = {
  sketch: string;
  color: string;
  motion: string;
  sketchNote: string;
  colorNote: string;
  motionNote: string;
};
export function CraftStudy(p: CraftProps) {
  const [stage, setStage] = useState(0);
  const labels = [p.sketch, p.color, p.motion];
  const notes = [p.sketchNote, p.colorNote, p.motionNote];
  return (
    <div className={`craft-study stage-${stage}`}>
      <div className="study-top" aria-hidden="true">
        <span>Q / M</span>
        <span>FIELD NOTES — 01</span>
      </div>
      <svg
        className="tree-study"
        viewBox="0 0 520 330"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <filter id="wash">
            <feTurbulence
              type="fractalNoise"
              baseFrequency=".025"
              numOctaves="3"
              seed="7"
            />
            <feDisplacementMap in="SourceGraphic" scale="14" />
          </filter>
        </defs>
        <g className="tree-color">
          <ellipse
            cx="260"
            cy="278"
            rx="151"
            ry="20"
            fill="#c8c69a"
            opacity=".48"
            filter="url(#wash)"
          />
          <path
            d="M150 161C93 94 173 36 216 63 236 12 310 27 320 72c81-13 108 83 48 109-29 42-80 26-108 12-57 40-118 12-110-32"
            fill="#909b6b"
            opacity=".6"
            filter="url(#wash)"
          />
          <path
            d="M174 115c20-39 76-49 103-32 50-30 103 11 80 54-15 36-74 31-104 18-37 31-94-9-79-40"
            fill="#b7b47c"
            opacity=".65"
            filter="url(#wash)"
          />
        </g>
        <g
          className="tree-branches"
          stroke="#526044"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M239 278c18-35 12-71 20-116m20 118c-16-42-7-72-20-118m-20 116c-9 1-18 4-27 9m65-8 19 7M258 215c-18-31-45-38-60-69m64 58c20-37 47-35 66-63m-70 32c1-31-18-52-21-74m24 77c23-34 29-43 32-68M236 188l-33-6m80-8 17-34m-47 12-29-23m57 7 24-5" />
          <path
            d="M169 134c-31 4-45-20-31-43 2-25 25-40 47-34 18-33 58-37 78-12 31-27 70-14 79 15 39-2 66 37 47 66 13 31-12 57-43 54-30 31-64 10-86 4-34 27-65 20-77-3-28 3-49-22-37-44"
            strokeWidth="1.1"
            opacity=".65"
          />
          <path
            d="m185 98 13 10m-12 2 12-2m106-26-9 12m9-1-9 1m56 51-15 4m9 7-9-7M165 159l13-4m-9-8 9 8M225 69l8 12m7-10-7 10M96 286q37-9 66-2m161 4q49-12 98-4M158 275l-6-9m6 9 6-12m199 9 6-11m-6 11-5-7"
            strokeWidth="1"
          />
        </g>
        <g
          className="study-bird"
          stroke="#526044"
          strokeWidth="1.7"
          strokeLinecap="round"
        >
          <path d="M365 57q9-11 18 0 9-11 18 0m-51-24q5-6 10 0 5-6 10 0" />
        </g>
      </svg>
      <div className="study-caption" aria-live="polite">
        {notes[stage]}
      </div>
      <div className="study-switch" role="group" aria-label={labels.join(", ")}>
        {labels.map((label, i) => (
          <button
            key={label}
            onClick={() => setStage(i)}
            aria-pressed={stage === i}
          >
            <span aria-hidden="true">0{i + 1}</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
