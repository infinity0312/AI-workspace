import { openMeteo,type WeatherProvider } from './runtime/weather-provider';
import { databaseUrl,isLocal } from './config';
import { Artifacts } from './domain/artifacts';
import { Workspaces } from './domain/access';
import { Exports } from './domain/exports';
import { Jobs } from './domain/jobs';
import { Imports } from './domain/imports';
import { Knowledge } from './domain/knowledge';
import { Library } from './domain/library';
import { Collaboration } from './domain/collaboration';
import { Schedules } from './domain/schedules';
import { LearningProgress } from './domain/learning-progress';
import { Study } from './domain/study';
import { Sync } from './domain/sync';
import { migrate, openDatabase, type Database } from './platform/database';
import { openObjects, type ObjectStore } from './platform/objects';
import { publicResearch, type PublicResearch } from './runtime/public-research';
import { embeddingProvider, modelGateway, searchProvider } from './runtime/providers';
import { deepSeekStreamingGateway,type StreamingGateway } from './runtime/harness/adapter';
import { harnessRollout,type HarnessRollout } from './runtime/harness/session';

export const SERVICES = Symbol('services');

export function services(db: Database, objects: ObjectStore, providers: {
  model?: ReturnType<typeof modelGateway>;
  search?: ReturnType<typeof searchProvider>;
  embed?: ReturnType<typeof embeddingProvider>;
  publicResearch?:PublicResearch;
  weather?:WeatherProvider;
  harness?:{ gateway:StreamingGateway;rollout:HarnessRollout };
} = {}) {
  const artifacts = new Artifacts(db);
  const knowledge = new Knowledge(db,objects);
  const exports = new Exports(db,artifacts,objects,knowledge);
  const jobs = new Jobs(db,knowledge,artifacts,exports,providers.model,providers.search,providers.embed,providers.publicResearch,providers.harness,providers.weather);
  return {
    db, artifacts, jobs, search:providers.search, publicResearch:providers.publicResearch,collaboration:new Collaboration(db,artifacts),schedules:new Schedules(db,jobs), knowledge, library:new Library(db,artifacts,knowledge), study:new Study(db),learning:new LearningProgress(db,artifacts), imports:new Imports(db,objects),
    workspaces: new Workspaces(db),
    sync: new Sync(db,artifacts),
  };
}

export async function openServices() {
  const db = await openDatabase();
  try {
    await migrate(db,Boolean(databaseUrl));
    const search=searchProvider();
    const key=process.env.DEEPSEEK_API_KEY;
    const harness=key ? { gateway:deepSeekStreamingGateway(key,process.env.DEEPSEEK_MODEL ?? 'deepseek-flash'),rollout:harnessRollout(process.env) } : undefined;
    return services(db,openObjects(),{ model:modelGateway(),search,embed:embeddingProvider(),publicResearch:publicResearch(search),harness,weather:isLocal ? openMeteo() : undefined });
  } catch (error) {
    await db.close();
    throw error;
  }
}
export type Services = ReturnType<typeof services>;
