"use client";

import { useState } from "react";

const STAR_COLORS = ["#c48c2f", "#0169AC", "#8e203a"];

// Each star's center point for transform-origin
const STAR_ORIGINS = [
  "210px 30px",
  "230px 80px",
  "190px 90px",
  "245px 140px",
  "175px 155px",
];

interface AnimationVariant {
  name: string;
  textKeyframes: string;
  starKeyframes: string;
  textStyle: string;
  starBaseStyle: string;
  starDelays: number[];
}

const ANIMATIONS: AnimationVariant[] = [
  {
    // 1. Spin In — stars spin from scale(0) rotate(-180°)
    name: "spin-in",
    textKeyframes: `
      @keyframes textAnim {
        0% { opacity: 0; transform: translateX(-12px); }
        100% { opacity: 1; transform: translateX(0); }
      }`,
    starKeyframes: `
      @keyframes starAnim {
        0% { opacity: 0; transform: scale(0) rotate(-180deg); }
        100% { opacity: 1; transform: scale(1) rotate(0deg); }
      }`,
    textStyle: "animation: textAnim 0.8s ease-out forwards;",
    starBaseStyle:
      "animation: starAnim 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;",
    starDelays: [0.3, 0.45, 0.6, 0.75, 0.9],
  },
  {
    // 2. Drop Bounce — stars fall from above
    name: "drop-bounce",
    textKeyframes: `
      @keyframes textAnim {
        0% { opacity: 0; transform: translateY(15px); }
        100% { opacity: 1; transform: translateY(0); }
      }`,
    starKeyframes: `
      @keyframes starAnim {
        0% { opacity: 0; transform: translateY(-60px); }
        60% { opacity: 1; transform: translateY(6px); }
        80% { transform: translateY(-3px); }
        100% { opacity: 1; transform: translateY(0); }
      }`,
    textStyle: "animation: textAnim 0.7s ease-out forwards;",
    starBaseStyle: "animation: starAnim 0.7s ease-out forwards;",
    starDelays: [0.2, 0.35, 0.5, 0.65, 0.8],
  },
  {
    // 3. Fly From Right — stars slide in from the right
    name: "fly-right",
    textKeyframes: `
      @keyframes textAnim {
        0% { opacity: 0; transform: translateX(-20px); }
        100% { opacity: 1; transform: translateX(0); }
      }`,
    starKeyframes: `
      @keyframes starAnim {
        0% { opacity: 0; transform: translateX(80px); }
        100% { opacity: 1; transform: translateX(0); }
      }`,
    textStyle: "animation: textAnim 0.6s ease-out forwards;",
    starBaseStyle:
      "animation: starAnim 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;",
    starDelays: [0.15, 0.3, 0.45, 0.6, 0.75],
  },
  {
    // 4. Pop Scale — stars pop with overshoot
    name: "pop-scale",
    textKeyframes: `
      @keyframes textAnim {
        0% { opacity: 0; transform: scale(0.85); }
        60% { transform: scale(1.03); }
        100% { opacity: 1; transform: scale(1); }
      }`,
    starKeyframes: `
      @keyframes starAnim {
        0% { opacity: 0; transform: scale(0); }
        50% { opacity: 1; transform: scale(1.3); }
        75% { transform: scale(0.9); }
        100% { opacity: 1; transform: scale(1); }
      }`,
    textStyle: "animation: textAnim 0.7s ease-out forwards;",
    starBaseStyle: "animation: starAnim 0.5s ease-out forwards;",
    starDelays: [0.2, 0.32, 0.44, 0.56, 0.68],
  },
  {
    // 5. Fade Up — gentle float up
    name: "fade-up",
    textKeyframes: `
      @keyframes textAnim {
        0% { opacity: 0; transform: translateY(20px); }
        100% { opacity: 1; transform: translateY(0); }
      }`,
    starKeyframes: `
      @keyframes starAnim {
        0% { opacity: 0; transform: translateY(30px); }
        100% { opacity: 1; transform: translateY(0); }
      }`,
    textStyle: "animation: textAnim 0.9s ease-out forwards;",
    starBaseStyle: "animation: starAnim 0.8s ease-out forwards;",
    starDelays: [0.1, 0.25, 0.4, 0.55, 0.7],
  },
  {
    // 6. Scatter In — each star from a different direction
    name: "scatter",
    textKeyframes: `
      @keyframes textAnim {
        0% { opacity: 0; }
        100% { opacity: 1; }
      }
      @keyframes star1 {
        0% { opacity: 0; transform: translate(-40px, -30px) rotate(-45deg); }
        100% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
      }
      @keyframes star2 {
        0% { opacity: 0; transform: translate(50px, -20px) rotate(60deg); }
        100% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
      }
      @keyframes star3 {
        0% { opacity: 0; transform: translate(30px, 40px) rotate(-90deg); }
        100% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
      }
      @keyframes star4 {
        0% { opacity: 0; transform: translate(60px, -40px) rotate(120deg); }
        100% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
      }
      @keyframes star5 {
        0% { opacity: 0; transform: translate(-50px, 30px) rotate(-60deg); }
        100% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
      }`,
    starKeyframes: "", // included in textKeyframes above
    textStyle: "animation: textAnim 0.6s ease-out forwards;",
    starBaseStyle: "", // per-star below
    starDelays: [0.2, 0.35, 0.5, 0.65, 0.8],
  },
  {
    // 7. Flip In — stars flip on Y axis
    name: "flip-in",
    textKeyframes: `
      @keyframes textAnim {
        0% { opacity: 0; transform: rotateX(10deg) translateY(8px); }
        100% { opacity: 1; transform: rotateX(0) translateY(0); }
      }`,
    starKeyframes: `
      @keyframes starAnim {
        0% { opacity: 0; transform: rotateY(90deg) scale(0.5); }
        100% { opacity: 1; transform: rotateY(0deg) scale(1); }
      }`,
    textStyle: "animation: textAnim 0.7s ease-out forwards;",
    starBaseStyle:
      "animation: starAnim 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;",
    starDelays: [0.25, 0.4, 0.55, 0.7, 0.85],
  },
  {
    // 8. Zoom Burst — stars shrink from large to normal
    name: "zoom-burst",
    textKeyframes: `
      @keyframes textAnim {
        0% { opacity: 0; transform: scale(1.4); }
        100% { opacity: 1; transform: scale(1); }
      }`,
    starKeyframes: `
      @keyframes starAnim {
        0% { opacity: 0; transform: scale(2.5); }
        70% { opacity: 1; transform: scale(0.9); }
        100% { opacity: 1; transform: scale(1); }
      }`,
    textStyle: "animation: textAnim 0.6s ease-out forwards;",
    starBaseStyle: "animation: starAnim 0.5s ease-out forwards;",
    starDelays: [0.05, 0.15, 0.25, 0.35, 0.45],
  },
];

function buildCSS(anim: AnimationVariant, fill: string) {
  const isScatter = anim.name === "scatter";

  const starStyles = STAR_ORIGINS.map((origin, i) => {
    const delay = anim.starDelays[i];
    if (isScatter) {
      return `.star-${i + 1} {
        animation: star${i + 1} 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}s forwards;
        transform-origin: ${origin};
      }`;
    }
    return `.star-${i + 1} {
      ${anim.starBaseStyle}
      animation-delay: ${delay}s;
      transform-origin: ${origin};
    }`;
  }).join("\n");

  return `
    .logo-text { fill: #F4F6F8; }
    .star-piece { fill: ${fill}; opacity: 0; }
    .logo-text-group { opacity: 0; ${anim.textStyle} }
    ${anim.textKeyframes}
    ${anim.starKeyframes}
    ${starStyles}
  `;
}

interface AnimatedLogoProps {
  className?: string;
  color?: string;
  ariaLabel?: string;
}

export { STAR_COLORS };

export function AnimatedLogo({ className, color, ariaLabel }: AnimatedLogoProps) {
  // Cache only the animation variant (stable across renders); use color prop reactively
  const [anim] = useState(
    () => ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)]
  );
  const fill = color || STAR_COLORS[0];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 263.23 187.48"
      className={className}
      aria-label={ariaLabel ?? "Stir Trek"}
      suppressHydrationWarning
    >
      <style suppressHydrationWarning>
        {buildCSS(anim, fill)}
      </style>

      {/* STIR TREK text — white */}
      <g className="logo-text-group">
        <path
          className="logo-text"
          d="M76.39,22.35c9.6,0,12.45,5.74,8.79,15.8l-.72,1.97h-9.34l.95-2.6c1.63-4.49.46-6.19-2.68-6.19s-5.56,1.7-7.19,6.19c-4.71,12.93,13.71,15.35,7.18,33.3-3.66,10.05-10.78,15.8-20.47,15.8s-12.63-5.74-8.97-15.8l1.4-3.86h9.34l-1.63,4.49c-1.63,4.49-.25,6.1,2.9,6.1s5.71-1.62,7.34-6.1c4.7-12.93-13.71-15.35-7.18-33.3,3.66-10.05,10.68-15.8,20.29-15.8Z"
        />
        <path
          className="logo-text"
          d="M91.75,23.06h30.52l-3.26,8.97h-10.32l-19.6,53.86h-9.87l19.6-53.86h-10.32l3.27-8.97Z"
        />
        <path
          className="logo-text"
          d="M126.57,23.06h9.87l-22.87,62.83h-9.87l22.87-62.83Z"
        />
        <path
          className="logo-text"
          d="M141.4,85.89c.05-1.61.05-2.6,1.91-7.72l3.59-9.87c2.12-5.84.93-7.99-3.55-7.99h-3.41l-9.31,25.58h-9.87l22.87-62.83h14.9c10.23,0,12.9,4.76,9.37,14.45l-1.8,4.94c-2.35,6.46-5.95,10.68-11.1,12.75,4.18,2.06,4.07,6.82,1.68,13.37l-3.53,9.7c-1.11,3.05-1.84,5.3-1.7,7.63h-10.05ZM150.23,32.04l-7.02,19.3h3.86c3.68,0,6.51-1.61,8.34-6.64l2.25-6.19c1.63-4.48.83-6.46-2.67-6.46h-4.76Z"
        />
        <path
          className="logo-text"
          d="M12.55,98.79h30.52l-3.27,8.97h-10.32l-19.6,53.86H0l19.6-53.86h-10.32l3.27-8.97Z"
        />
        <path
          className="logo-text"
          d="M45.14,161.62c.05-1.61.05-2.6,1.91-7.72l3.59-9.87c2.12-5.83.94-7.99-3.55-7.99h-3.41l-9.31,25.58h-9.87l22.87-62.83h14.9c10.23,0,12.9,4.76,9.37,14.45l-1.8,4.94c-2.35,6.46-5.95,10.68-11.1,12.75,4.19,2.06,4.07,6.82,1.69,13.37l-3.53,9.7c-1.11,3.05-1.84,5.29-1.7,7.63h-10.05ZM53.97,107.76l-7.02,19.3h3.86c3.68,0,6.51-1.61,8.34-6.64l2.25-6.19c1.63-4.48.83-6.46-2.67-6.46h-4.76Z"
        />
        <path
          className="logo-text"
          d="M83.68,125.27h13.55l-3.27,8.97h-13.55l-6.7,18.4h17.06l-3.27,8.97h-26.93l22.87-62.83h26.93l-3.27,8.97h-17.05l-6.37,17.51Z"
        />
        <path
          className="logo-text"
          d="M115.64,136.57l-5.14,5.75-7.03,19.3h-9.88l22.87-62.83h9.87l-9.96,27.38,22.89-27.38h9.87l-23.92,28,1.06,34.83h-10.14l-.49-25.04Z"
        />
      </g>

      {/* Star triangles — animated in one by one */}
      <path
        className="star-piece star-1"
        d="M188.35,55.64c-1.31.2-2.63-.28-3.51-1.29-.91-1.06-1.19-2.52-.71-3.84L201.4,2.55c.48-1.34,1.66-2.29,3.04-2.5.19-.03.39-.05.59-.05,1.63,0,3.08,1.03,3.63,2.56l14.87,41.41c.38,1.06.28,2.23-.27,3.2-.55.98-1.5,1.67-2.6,1.9l-32.14,6.54c-.06.01-.12.02-.18.03Z"
      />
      <path
        className="star-piece star-2"
        d="M239.41,101.78c-1.08.16-2.21-.13-3.09-.87l-33.13-28.15c-1.12-.95-1.61-2.46-1.24-3.88.36-1.43,1.5-2.52,2.93-2.83l21.38-4.58c.08-.02.15-.03.22-.04,1.81-.28,3.59.76,4.22,2.51l11.75,32.73c.59,1.65,0,3.49-1.44,4.48-.49.34-1.04.56-1.61.64Z"
      />
      <path
        className="star-piece star-3"
        d="M208.64,106.92c-.2.03-.4.05-.61.04l-38.69-.18c-1.26,0-2.43-.62-3.15-1.65-.72-1.03-.89-2.34-.47-3.52l8.59-23.85c.42-1.17,1.38-2.06,2.58-2.41.15-.04.31-.07.46-.1,1.06-.17,2.15.12,3,.8l30.1,24.03c1.29,1.03,1.78,2.75,1.23,4.3-.48,1.36-1.67,2.32-3.05,2.53Z"
      />
      <path
        className="star-piece star-4"
        d="M259.95,158.99c-1.03.16-2.11-.1-2.97-.78l-34.21-26.89c-.94-.73-1.48-1.86-1.48-3.05,0-1.19.56-2.31,1.51-3.04l19.22-14.83c.52-.4,1.13-.66,1.77-.76.55-.09,1.12-.05,1.67.11,1.18.35,2.13,1.24,2.55,2.4l14.98,41.71c.58,1.62.02,3.43-1.38,4.43-.51.37-1.08.6-1.67.69Z"
      />
      <path
        className="star-piece star-5"
        d="M140.89,187.43c-.96.15-1.98-.08-2.82-.67-1.41-1-1.99-2.83-1.4-4.46l20.48-56.88c.48-1.35,1.66-2.29,3.04-2.51.22-.03.45-.05.69-.04l47.71,1.18c1.62.04,3.04,1.08,3.55,2.61.53,1.53.05,3.22-1.21,4.24l-68.19,55.69c-.55.45-1.19.72-1.85.83Z"
      />
    </svg>
  );
}
