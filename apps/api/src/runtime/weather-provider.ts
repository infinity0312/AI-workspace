import { z } from 'zod';
import { weatherAttrs,type WeatherData } from '@akw/contracts';
import { AppError } from '../platform/errors';
import { providerJson } from './providers';
import type { WeatherQuery } from './task-routing';

const places=z.object({ results:z.array(z.object({
  name:z.string(),latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),country:z.string().optional(),
  country_code:z.string().optional(),admin1:z.string().optional(),admin2:z.string().optional(),population:z.number().optional(),
})).max(12).default([]) });
const values=z.array(z.number().nullable()).max(168);
const forecast=z.object({
  timezone:z.string(),
  current:z.object({ time:z.string(),temperature_2m:z.number().nullable(),apparent_temperature:z.number().nullable(),
    relative_humidity_2m:z.number().nullable(),wind_speed_10m:z.number().nullable(),weather_code:z.number().nullable() }).optional(),
  hourly:z.object({ time:z.array(z.string()).max(168),temperature_2m:values,precipitation_probability:values }),
  daily:z.object({ time:z.array(z.string()).max(7),temperature_2m_max:values,temperature_2m_min:values,
    precipitation_probability_max:values,weather_code:values }),
});
export type WeatherProvider=(query:WeatherQuery,signal:AbortSignal)=>Promise<WeatherData>;
const cacheMs=10*60_000;
const comparable=(text:string)=>text.normalize('NFKC').toLocaleLowerCase().replace(/(?:省|市|区|县|自治州|[\s.-])/g,'');
export function openMeteo(request:typeof fetch=fetch,now:()=>Date=()=>new Date()):WeatherProvider {
  const cache=new Map<string,WeatherData>();
  async function get(url:URL,signal:AbortSignal) {
    const deadline=AbortSignal.any([signal,AbortSignal.timeout(9500)]);
    for (let attempt=0;attempt<2;attempt++) {
      try {
        const response=await request(url,{ signal:AbortSignal.any([deadline,AbortSignal.timeout(4500)]),redirect:'error',
          headers:{ Accept:'application/json' } });
        return await providerJson(response,250_000);
      } catch (error) {
        signal.throwIfAborted();
        const transient=error instanceof TypeError || (error instanceof DOMException && error.name==='TimeoutError') ||
          (error instanceof AppError && error.code==='PROVIDER_REQUEST_FAILED' && error.retryable);
        if (!transient || deadline.aborted) break;
      }
    }
    throw new AppError(502,'WEATHER_PROVIDER_UNAVAILABLE','The forecast provider did not respond');
  }

  async function geocodePlace(query:WeatherQuery,signal:AbortSignal) {
    const segments=query.city.split(/[,，]/).map(part=>part.trim()).filter(Boolean);
    const requested=segments[0]!;
    const qualifiers=segments.slice(1);
    const geocode=new URL('https://geocoding-api.open-meteo.com/v1/search');
    geocode.search=new URLSearchParams({ name:requested,count:'8',language:/\p{Script=Han}/u.test(query.city)?'zh':'en',format:'json' }).toString();
    const matching=places.safeParse(await get(geocode,signal));
    if (!matching.success) throw new AppError(502,'WEATHER_PROVIDER_UNAVAILABLE','The location provider returned invalid data');
    const candidates=matching.data.results.filter(item=>qualifiers.every(qualifier=>
      [item.country,item.country_code,item.admin1,item.admin2].some(value=>value && comparable(value)===comparable(qualifier))));
    const exact=candidates.filter(item=>comparable(item.name)===comparable(requested));
    const options=exact.length ? exact : candidates;
    const areaOf=(item:typeof options[number])=>[...new Set([item.admin1,item.country].filter(Boolean))].join(' · ');
    const first=options[0];
    if (!first) throw new AppError(422,'WEATHER_PLACE_NOT_FOUND','The city was not found');
    if (options.length>1 && options.some(item=>item!==first && areaOf(item)!==areaOf(first)) &&
      (first.population ?? 0)<500_000 && !qualifiers.length)
      throw new AppError(422,'WEATHER_AMBIGUOUS_PLACE','The city name is ambiguous',{ options:options.slice(0,4).map(item=>item.name+', '+[item.admin1,item.country].filter(Boolean).join(', ')) });
    return { name:first.name,area:areaOf(first),latitude:first.latitude,longitude:first.longitude };
  }

  return async (query,signal)=>{
    const key=[query.place ? [query.place.latitude,query.place.longitude].join(',') : comparable(query.city),query.offset,query.days].join('|');
    const prior=cache.get(key);
    if (!query.place && prior && new Date(prior.expires_at)>now()) {
      const localToday=new Intl.DateTimeFormat('en-CA',{ timeZone:prior.timezone,dateStyle:'short' }).format(now());
      const snapshotDay=new Intl.DateTimeFormat('en-CA',{ timeZone:prior.timezone,dateStyle:'short' }).format(new Date(prior.captured_at));
      if (localToday===snapshotDay) return prior;
    }
    const place=query.place ?? await geocodePlace(query,signal);
    const endpoint=new URL('https://api.open-meteo.com/v1/forecast');
    endpoint.search=new URLSearchParams({
      latitude:String(place.latitude),longitude:String(place.longitude),timezone:'auto',forecast_days:String(query.offset+query.days),
      current:'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
      hourly:'temperature_2m,precipitation_probability',
      daily:'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
      temperature_unit:'celsius',wind_speed_unit:'kmh',
    }).toString();
    const parsed=forecast.safeParse(await get(endpoint,signal));
    if (!parsed.success) throw new AppError(502,'WEATHER_PROVIDER_UNAVAILABLE','The forecast provider returned invalid data');
    const { current,hourly,daily,timezone }=parsed.data;
    try { new Intl.DateTimeFormat('en',{ timeZone:timezone }); }
    catch { throw new AppError(502,'WEATHER_PROVIDER_UNAVAILABLE','The forecast time zone is invalid'); }
    const time=now();
    const days=daily.time.slice(query.offset,query.offset+query.days).map((date,index)=>{
      const i=index+query.offset;
      return { date,low:daily.temperature_2m_min[i]??null,high:daily.temperature_2m_max[i]??null,
        precipitation:daily.precipitation_probability_max[i]??null,code:daily.weather_code[i]??null };
    });
    const dates=new Set(days.map(day=>day.date));
    const result=weatherAttrs.safeParse({ version:1,place,
      timezone,captured_at:time.toISOString(),expires_at:new Date(time.getTime()+cacheMs).toISOString(),
      window:{ offset:query.offset,days:query.days },
      current:query.offset===0 && current ? { time:current.time,temperature:current.temperature_2m,apparent:current.apparent_temperature,
        humidity:current.relative_humidity_2m,wind:current.wind_speed_10m,code:current.weather_code } : null,
      hours:hourly.time.flatMap((hour,index)=>dates.has(hour.slice(0,10)) ? [{ time:hour,temperature:hourly.temperature_2m[index]??null,
        precipitation:hourly.precipitation_probability[index]??null }] : []),days });
    if (!result.success || days.length!==query.days) throw new AppError(502,'WEATHER_PROVIDER_UNAVAILABLE','The requested forecast interval could not be validated');
    if (cache.size>=128) cache.delete(cache.keys().next().value!);
    cache.set(key,result.data);
    return result.data;
  };
}
