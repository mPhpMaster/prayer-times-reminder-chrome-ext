// Totals change on a state mutation, not on the one-second countdown. Keep
// one summary and invalidate it at the game's existing save boundary.
function createGameTotalsCache(sum) {
  let previousState = null;
  let previousDay = "";
  let totals = null;
  return {
    invalidate() { previousState = null; },
    read(state, day) {
      if (state !== previousState || day !== previousDay) {
        totals = { day: sum(state, day), month: sum(state, day.slice(0, 7)) };
        previousState = state;
        previousDay = day;
      }
      return totals;
    },
  };
}
