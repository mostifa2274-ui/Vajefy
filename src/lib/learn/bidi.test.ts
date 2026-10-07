import assert from "node:assert/strict";
import test from "node:test";
import { scriptLang, scriptRuns } from "./bidi";

const latin = (text: string) => scriptRuns(text).filter((run) => run.latin).map((run) => run.text);

test("embedded English words and phrases become their own runs", () => {
  assert.deepEqual(latin("ضمیر I همیشه با حرف بزرگ نوشته می‌شود."), ["I"]);
  assert.deepEqual(latin("در جای مفعول me به کار می‌رود."), ["me"]);
  assert.deepEqual(latin("you هم برای «تو» و هم برای «شما» به کار می‌رود."), ["you"]);
  assert.deepEqual(latin("الگوی I + verb را ببین"), ["I + verb"]);
});

test("an English stretch stays one run across its own punctuation, so it never reads backwards", () => {
  // Separate isolates would put ":" before "am" and reverse the examples.
  assert.deepEqual(latin("فعل be با I می‌شود am: I am / I'm."), ["be", "I", "am: I am / I'm."]);
  assert.deepEqual(
    latin("شکل be با فاعل عوض می‌شود: I am / he, she, it is / you, we, they are. مثال: I'm a student. / She's tired. / They're at home."),
    ["be", "I am / he, she, it is / you, we, they are.", "I'm a student. / She's tired. / They're at home."],
  );
  assert.deepEqual(
    latin("در گذشته برای I/he/she/it از was و برای you/we/they از were استفاده می‌کنیم: I was at home. / They were late."),
    ["I/he/she/it", "was", "you/we/they", "were", "I was at home. / They were late."],
  );
  // Brackets that hold Persian stay with the Persian.
  assert.deepEqual(latin("سه شکل دارد: am (با I)، is (با he/she/it)"), ["am", "I", "is", "he/she/it"]);
});

test("an English phrase keeps its full stop, but a lone English word leaves it to the Persian sentence", () => {
  assert.deepEqual(latin("You are kind. (حتی برای یک نفر are)"), ["You are kind.", "are"]);
  assert.deepEqual(latin("برای «وجود داشتن»: There is a bank near here."), ["There is a bank near here."]);
  assert.deepEqual(latin("می‌گوییم hello."), ["hello"]);
});

test("phrases of three words or more are marked long, so they stay in one block", () => {
  const runs = scriptRuns("مثال: I'm a student. / She's tired. و he/she/it و I am");
  assert.deepEqual(
    runs.filter((run) => run.latin).map((run) => [run.text, Boolean(run.long)]),
    [["I'm a student. / She's tired.", true], ["he/she/it", true], ["I am", false]],
  );
});

test("runs rebuild the original text exactly, and Persian-only text is one run", () => {
  for (const text of ["You are kind. (حتی برای یک نفر are)", "سلام", "A1 و B2+", "who: چه کسی؛ که", "۲۶٫۱ MB", ""]) {
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
