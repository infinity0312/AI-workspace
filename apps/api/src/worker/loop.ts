import { setTimeout as delay } from 'node:timers/promises';
import type { Jobs } from '../domain/jobs';

import type { Schedules } from '../domain/schedules';

export async function runWorker(jobs: Jobs, schedules:Schedules, signal: AbortSignal) {
  await Promise.all([runLane(jobs,schedules,signal,'general'),runLane(jobs,schedules,signal,'interactive')]);
}

async function runLane(jobs:Jobs,schedules:Schedules,signal:AbortSignal,lane:'general'|'interactive') {
  let nextCheck = 0;
  while (!signal.aborted) {
    try {
      if (lane==='general' && Date.now() >= nextCheck) {
        nextCheck = Date.now() + 15000;
        await schedules.enqueueDue();
      }
      if (await jobs.next(signal,lane)) continue;
    } catch (error) {
      if (!signal.aborted) console.error(JSON.stringify({ level:'error',message:'Worker cycle failed',type: error instanceof Error ? error.name : 'Unknown' }));
    }
    await delay(lane==='interactive' ? 200 : 600,undefined,{ signal }).catch(() => {});
  }
}
