import { AppError } from '../platform/errors';
import type { WeatherData } from '@akw/contracts';

const learning=/系统学习|学习路径|循序渐进|自学|学习计划|想学会|^(?:我)?(?:想|要)学(?:习)?|(?:^|\b)(?:teach me|study plan|learn systematically|i (?:want|would like) to learn)\b/i;
const weather=/天气|气温|降雨|下雨|降雪|天气预报|\b(?:weather|forecast|rain tomorrow|temperature forecast)\b/i;
const guide=/怎么|如何|怎样|使用方法|操作方法|教程|步骤|\b(?:how (?:do|to|can)|instructions|steps|guide)\b/i;
const locationStops=/今天|今日|今天天|明天|明日|后天|当前|现在|未来|接下来|这几天|本周|周末|今晚|查(?:一下)?|查询|看(?:一下)?|的?(?:天气预报|天气|气温|降雨概率|降雨|下雨|降雪)|(?:会|有)不会|会|是否|\d+\s*天/g;
export type WeatherQuery={ city:string;offset:number;days:number;place?:WeatherData['place'] };
const liveWeather=/是什么|定义|原理|为什么|怎么形成|怎样形成|气候变化|(?:通过|使用|编写|开发|接入).{0,40}(?:API|接口)|\b(?:historical|historically|climate|formation)\b/i;
const compare=/对比|比较|区别|异同|分别.{0,14}优劣|\b(?:compare|versus|differences?)\b/i;
const explicitBrowse=/打开(?:网页|网站|链接)|搜(?:索|下|一下)?(?:网页|网站|来源)|找.{0,12}(?:官网|网站|链接)|\b(?:browse|open (?:this|website)|find (?:the )?(?:website|official page))\b/i;
const capabilityMatchers=[
  { id:'learning', match:(goal:string)=>learning.test(goal) },
  { id:'weather', match:(goal:string)=>weather.test(goal) && !liveWeather.test(goal) },
  { id:'comparison', match:(goal:string)=>compare.test(goal) },
  { id:'guide', match:(goal:string)=>guide.test(goal) },
  { id:'browse', match:(goal:string)=>explicitBrowse.test(goal) || /^https?:\/\/\S+$/i.test(goal) },
] as const;
export type TaskCapability=typeof capabilityMatchers[number]['id']|'information';
export type PlannedStep={ capability:TaskCapability; goal:string; weather?:WeatherQuery;location?:string;sources?:string[] };
function selectCapability(goal:string):TaskCapability {
  return capabilityMatchers.find(entry=>entry.match(goal))?.id ?? 'information';
}

export function planTask(goal:string,location?:string):PlannedStep[] {
  const pieces=goal.split(/[；;\n]+|\s+\band then\b\s+|[，,。]\s*(?=(?:(?:并且?|同时|也)\s*)?(?:再|另外|顺便|查一下|查查|对比|比较|告诉我|怎么|如何|什么是|学会|make|then|also|compare|打开|搜索|找官网))/iu);
  const substantial=pieces.map(part=>part.trim().replace(/^(?:并且?|然后|再|同时|也|另外|顺便|then\b|also\b)\s*/i,'')).filter(Boolean);
  const accepted=substantial.map(part=>({ capability:selectCapability(part),goal:part }));
  const subject=accepted.length<2 ? [{ capability:selectCapability(goal),goal }] : accepted;
  const distinct=subject.filter((item,index)=>subject.findIndex(other=>other.goal===item.goal && other.capability===item.capability)===index);
  if (distinct.length>5) throw new AppError(422,'TASK_TOO_MANY_PARTS','Use up to five task parts');
  return distinct.map(step=>step.capability==='weather' && distinct.length===1 ? { ...step,weather:weatherQuery(step.goal,location) } :
    step.capability==='weather' && location ? { ...step,location } : step);
}

export function weatherQuery(goal:string,location?:string):WeatherQuery {
  if (/昨天|昨日|上周|过去|上个月|历史|国内|全国|全球|比较|对比|周末|本周|下周|明年|下个月|\d{4}[-年/]|\d{1,2}月\d{1,2}日|星期[一二三四五六日天]|周[一二三四五六日天]|\b(?:yesterday|last week|vs\.?|weekend|next week)\b/i.test(goal))
    throw new AppError(422,'WEATHER_WINDOW_UNSUPPORTED','Use one city and today, tomorrow, or the next few days');
  const offset=/后天|day after tomorrow/i.test(goal) ? 2 : /明天|明日|tomorrow/i.test(goal) ? 1 : 0;
  const explicit=/(\d{1,2})\s*天|\b(\d{1,2})\s*days?\b/i.exec(goal);
  const inChinese=/([一二两三四五六七八九十])天/.exec(goal);
  const chinese:Record<string,number>={ 一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10 };
  const days=explicit ? Number(explicit[1] ?? explicit[2]) : inChinese ? chinese[inChinese[1]!]! :
    /未来|接下来|几天|next few days/i.test(goal) ? 3 : 1;
  if (days<1 || offset+days>7) throw new AppError(422,'WEATHER_WINDOW_UNSUPPORTED','The forecast is limited to seven days');
  const city=location?.trim() ?? goal
    .replace(/请(?:帮我|问)?|我想(?:知道|看看)?|帮我|我这(?:里|儿)|当地|附近|怎么样|如何|如何呢|多少|几度|可能|吗|呢|一下|能不能|适合.{0,12}$|会有|会不会/g,'')
    .replace(/[一二两三四五六七八九十]天/g,'')
    .replace(locationStops,'')
    .replace(/\b(?:current|weather|forecast|tomorrow|day after|today|next|few|days?|for|in|please|tell me|show me|what(?:'s| is))\b/gi,' ')
    .replace(/\d{1,2}(?=\s|$)/g,'')
    .replace(/[？。？！?!]/g,' ').trim().replace(/\s+/g,' ');
  if (city.length<2 || city.length>80 || !/^[\p{L}\p{M}\s.,，·()-]+$/u.test(city) || /和|以及|\band\b/i.test(city))
    throw new AppError(422,'WEATHER_PLACE_REQUIRED','Specify a single city, optionally with its province or country');
  return { city,offset,days };
}
