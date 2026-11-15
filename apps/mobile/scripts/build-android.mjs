import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const android = fileURLToPath(new URL('../android',import.meta.url));
const tooling = fileURLToPath(new URL('../../../.data/tooling/',import.meta.url));
const java = join(tooling,'java21');
const localJava = existsSync(java) && readdirSync(java).find(name => existsSync(join(java,name,'bin','java.exe')));
const env = { ...process.env };
if (localJava && (!env.JAVA_HOME || !existsSync(join(env.JAVA_HOME,'bin','java.exe')))) env.JAVA_HOME = join(java,localJava);
if ((!env.ANDROID_HOME || !existsSync(env.ANDROID_HOME)) && existsSync(join(tooling,'android-sdk','platforms'))) env.ANDROID_HOME = join(tooling,'android-sdk');
if (!env.GRADLE_USER_HOME) env.GRADLE_USER_HOME = join(tooling,'gradle');
const windows = process.platform === 'win32';
if (windows && !env.JAVA_TOOL_OPTIONS?.includes('jdk.net.unixdomain.tmpdir')) {
  const temp = join(tooling,'java-tmp');
  mkdirSync(temp,{ recursive:true });
  env.JAVA_TOOL_OPTIONS = [env.JAVA_TOOL_OPTIONS,'"-Djdk.net.unixdomain.tmpdir=' + temp + '"','"-Djava.io.tmpdir=' + temp + '"'].filter(Boolean).join(' ');
}
const command = windows ? 'gradlew.bat' : './gradlew';
const result = spawnSync(command,[':app:assembleDebug'],{ cwd:android,env,stdio:'inherit',shell:windows });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
