import type { Lesson } from '../education/types';
import { stageSheets } from './educationRunner';

/**
 * Printable lesson worksheet (M12-C02): every stage's title and text at the chosen level, with the
 * picture and measured labels of each stage shown so far, prediction prompts with space to write,
 * and the exam question with answer lines. `answers` adds the model answer, hidden-answer labels
 * and the common mistake (teacher copy). Printed from a hidden frame (works in browsers and the Mac app).
 */
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const lines = (n: number) => `<div class="lines">${'<div></div>'.repeat(n)}</div>`;

export function lessonSheetHtml(lesson: Lesson, level: 'ks3' | 'gcse', answers: boolean): string {
  const stages = lesson.stages
    .map((st, k) => {
      const sh = stageSheets[k];
      const labels = sh?.labels ?? [];
      const img = sh?.img
        ? `<img src="${sh.img}" alt="The model landscape at stage ${k + 1}, numbered points match the list">`
        : lesson.kind === 'emergent'
          ? `<p class="missing">Show this stage in the lesson to include its picture and measurements.</p>`
          : '';
      const list = labels.length
        ? `<ol class="labels">${labels.map((l) => `<li>${l.answer && !answers ? 'What is here? ' + lines(1) : esc(l.text)}</li>`).join('')}</ol>`
        : '';
      const predict = st.predict ? `<p class="predict"><b>Predict:</b> ${esc(st.predict)}</p>${lines(2)}` : '';
      return `<section class="stage"><h2>Stage ${k + 1}: ${esc(st.title)}</h2><p>${esc(level === 'ks3' ? st.ks3 : st.gcse)}</p>${predict}${img}${
        list ? `<h3>${lesson.kind === 'emergent' ? 'Measured in the model' : 'Labels'}</h3>${list}` : ''
      }</section>`;
    })
    .join('');
  const exam = lesson.exam
    ? `<section class="exam"><h2>Exam practice</h2><p><b>${esc(lesson.exam.question)}</b></p>${lines(Math.max(4, lesson.exam.marks * 2))}${
        answers ? `<p class="answer"><b>Model answer:</b> ${esc(lesson.exam.model)}</p>` : ''
      }${answers && lesson.misconception ? `<p class="answer"><b>Common mistake:</b> ${esc(lesson.misconception.wrong)} <b>Better:</b> ${esc(lesson.misconception.right)}</p>` : ''}</section>`
    : '';
  const kind = lesson.kind === 'emergent' ? 'Simulation: the landscape and its changes come from the model’s physics; numbers are measured on it.' : 'Guided model: a controlled demonstration of the process.';
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>${esc(lesson.title)}</title><style>
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { font: 11pt/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif; color: #1a1a1a; margin: 0; }
header { border-bottom: 3px solid #205b41; margin-bottom: 8pt; padding-bottom: 4pt; }
h1 { font-size: 17pt; margin: 0 0 2pt; color: #205b41; }
.meta { display: flex; gap: 16pt; font-size: 10pt; }
.meta span { flex: 1; border-bottom: 1px solid #999; padding-bottom: 2pt; }
.objective { background: #fff7c2; border-left: 4px solid #ffe627; padding: 4pt 8pt; margin: 6pt 0; }
.kind { font-size: 9pt; color: #555; }
h2 { font-size: 13pt; color: #006ddf; margin: 12pt 0 3pt; }
h3 { font-size: 10.5pt; margin: 6pt 0 2pt; }
.stage { break-inside: avoid; }
img { display: block; max-width: 100%; max-height: 95mm; margin: 4pt 0; border: 1px solid #bbb; border-radius: 3pt; }
ol.labels { margin: 0; padding-left: 18pt; }
ol.labels li::marker { color: #006ddf; font-weight: bold; }
.predict { margin: 4pt 0 0; }
.lines div { border-bottom: 1px solid #aaa; height: 18pt; }
.missing { color: #777; font-style: italic; }
.exam { break-inside: avoid; border-top: 2px solid #ff912a; margin-top: 10pt; }
.answer { background: #ffe9f6; border-left: 4px solid #ffb4e5; padding: 4pt 8pt; }
footer { margin-top: 12pt; font-size: 8.5pt; color: #666; }
</style></head><body>
<header><h1>${esc(lesson.title)}</h1><div class="meta"><span>Name:</span><span>Class:</span><span>Date:</span></div></header>
<p class="objective"><b>Objective:</b> ${esc(lesson.objective)}</p>
<p class="kind">${esc(kind)} Level: ${level === 'ks3' ? 'KS3' : 'GCSE'}.${answers ? ' Teacher copy (with answers).' : ''}</p>
${stages}${exam}
<footer>Terra Genesis — ${esc(typeof location === 'undefined' ? '' : location.origin + location.pathname)}?lesson=${esc(lesson.id)}</footer>
</body></html>`;
}

/** Print the worksheet through a hidden frame. */
export function printLessonSheet(lesson: Lesson, level: 'ks3' | 'gcse', answers: boolean): void {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  f.setAttribute('aria-hidden', 'true');
  document.body.appendChild(f);
  const doc = f.contentDocument!;
  doc.open();
  doc.write(lessonSheetHtml(lesson, level, answers));
  doc.close();
  const go = () => {
    f.contentWindow!.focus();
    f.contentWindow!.print();
    setTimeout(() => f.remove(), 60000);
  };
  // Wait for the pictures to decode before printing.
  const imgs = [...doc.images];
  Promise.all(imgs.map((im) => (im.complete ? Promise.resolve() : new Promise((r) => (im.onload = im.onerror = r))))).then(go);
}
