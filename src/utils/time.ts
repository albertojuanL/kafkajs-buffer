// Get milliseconds elapsed from an instant
export const getElapsedTimeInMs = (start: [number, number]) => {
  const elapsed = process.hrtime(start);
  return elapsed[0] * 1000 + elapsed[1] / 1000000;
};
