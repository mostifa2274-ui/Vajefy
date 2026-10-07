import assert from "node:assert/strict";
import test from "node:test";
import { scriptLang, scriptRuns } from "./bidi";

const latin = (text: string) => scriptRuns(text).filter((run) => run.latin).map((run) => run.text);

test("embedded English words and phrases become their own runs", () => {
  assert.deepEqual(latin("ضمیر I همیشه با حرف بزرگ نوشته می‌شود."), ["I"]);
  assert.deepEqual(latin("در جای مفعول me به کار می‌رود."), ["me"]);
  assert.deepEqual(latin("you هم برای «تو» و هم برای «شما» به کار می‌رود."), ["you"]);
  assert.deepEqual(latin("الگوی I + verb را ببین"), ["I + verb"]);
  assert.deepEqual(latin("فعل be با I می‌شود am: I am / I'm."), ["be", "I", "am", "I am / I'm"]);
});

test("an English sentence keeps its full stop when Persian follows, but a Persian sentence keeps its own", () => {
  assert.deepEqual(latin("You are kind. (حتی برای یک نفر are)"), ["You are kind.", "are"]);
  assert.deepEqual(latin("می‌گوییم hello."), ["hello"]);
  assert.deepEqual(latin("مثال: I am a student."), ["I am a student"]);
});

test("runs rebuild the original text exactly, and Persian-only text is one run", () => {
  for (const text of ["You are kind. (حتی برای یک نفر are)", "سلام", "A1 و B2+", "who: چه کسی؛ که", ""]) {
    assert.equal(scriptRuns(text).map((run) => run.text).join(""), text);
  }
  assert.deepEqual(scriptRuns("سلام دنیا"), [{ text: "سلام دنیا", latin: false }]);
});

test("text of varying language is Persian when it uses Arabic script", () => {
  assert.equal(scriptLang("نام؛ اسم"), "fa");
  assert.equal(scriptLang("پیش از book کدام حرف تعریف درست است؟"), "fa");
  assert.equal(scriptLang("What's your ______?"), "en");
  assert.equal(scriptLang("pronoun · /aɪ/"), "en");
});
