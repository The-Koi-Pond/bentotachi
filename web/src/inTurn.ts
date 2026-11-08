// Runs jobs one after another, each starting once the one before has
// finished (failed ones too). For saves that read the record as saved now,
// change it and save it back: two at once would both read the old copy, and
// the second would undo the first.
export function inTurn() {
  let last: Promise<unknown> = Promise.resolve();
  return <T>(job: () => Promise<T>): Promise<T> => {
    const run = last.then(job);
    // On purpose: a failure is the caller's to show; the next job still runs.
    last = run.catch(() => undefined);
    return run;
  };
}
