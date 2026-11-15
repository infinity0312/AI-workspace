import { z } from 'zod';
import type { LearningProgress } from './learning';

const id=z.uuid();
const link=z.url({ protocol:/^https?$/ }).max(2048).refine(value=>{const u=new URL(value);return !u.username && !u.password && !u.port;});
const text=(max:number)=>z.string().trim().min(1).max(max);
export const taskRequest=z.object({
  workspace_id:id,goal:text(1600),allow_external:z.literal(true),location:text(80).optional(),sources:z.array(link).max(6).optional(),
}).strict();
export const browseRequest=z.object({ workspace_id:id,query:text(600),allow_external:z.literal(true) }).strict();
export const sourceCollectionInput=z.object({
  workspace_id:id,title:text(140),items:z.array(z.object({ title:text(200),
    url:link,
  }).strict()).min(1).max(12),
}).strict();
export type BrowseResult={ title:string;url:string;provider:string;excerpt?:string };
export type BrowseResponse={ results:BrowseResult[];coverage:'web'|'public_catalogs';query:string };
export const weatherRefresh=z.object({ base_revision_id:id,block_id:id.optional(),allow_external:z.literal(true) }).strict();
export const taskModes=['weather','guide','information'] as const;
export const taskMode=z.enum(taskModes);
export type TaskMode=z.infer<typeof taskMode>;
export type ProductivityProgress=LearningProgress & {
  kind:'learning'|'information'|'composition';mode?:TaskMode;steps?:{ capability:string;goal:string }[];result:(NonNullable<LearningProgress['result']> & {
    options?:string[];gaps?:{ goal:string;code:string }[];
  })|null;
};
export const weatherPlace=z.object({ name:text(100),area:z.string().max(200),latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180) }).strict();
const number=z.number().nullable();
const probability=z.number().min(0).max(100).nullable();
const localTime=z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const day=z.iso.date();
export const weatherAttrs=z.object({
  version:z.literal(1),place:weatherPlace,timezone:text(100),captured_at:z.iso.datetime(),expires_at:z.iso.datetime(),
  window:z.object({ offset:z.number().int().min(0).max(6),days:z.number().int().min(1).max(7) }).strict()
    .refine(window=>window.offset+window.days<=7),
  current:z.object({ time:localTime,temperature:number,apparent:number,humidity:probability,wind:number,code:z.number().int().nullable() }).strict().nullable(),
  hours:z.array(z.object({ time:localTime,temperature:number,precipitation:probability }).strict()).max(168),
  days:z.array(z.object({ date:day,low:number,high:number,precipitation:probability,code:z.number().int().nullable() }).strict()).min(1).max(7),
}).strict();
export type WeatherData=z.infer<typeof weatherAttrs>;
export const taskGapAttrs=z.object({ version:z.literal(1),goal:text(1600),code:text(120) }).strict();
export const informationAttrs=z.object({
  version:z.literal(1),mode:z.enum(['guide','information']),goal:text(1600),scope:text(280),
}).strict();
export const guideStepAttrs=z.object({
  version:z.literal(1),number:z.number().int().positive().max(8),title:text(120),
}).strict();
