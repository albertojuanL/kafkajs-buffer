export const getTimeStr = (start: [number, number]) => {
  const precision = 3;
  const elapsed = process.hrtime(start)[1] / 1000000;
  return `${process.hrtime(start)[0]}s, ${elapsed.toFixed(precision)} ms`;
};

// Get milliseconds elapsed from an instant
export const getElapsedTimeInMs = (start: [number, number]) => {
  const elapsed = process.hrtime(start);
  return elapsed[0] * 1000 + elapsed[1] / 1000000;
};
