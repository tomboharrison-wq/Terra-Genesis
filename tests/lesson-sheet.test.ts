import { describe, expect, it } from 'vitest';
import { lessonSheetHtml } from '../src/app/lessonSheet';
import { stageSheets } from '../src/app/educationRunner';
import { lessonById } from '../src/education/lessons';

describe('printable lesson worksheet', () => {
  it('lists every stage at the chosen level, the measurements of shown stages, and answers only on the teacher copy', () => {
    const lesson = lessonById('headlands-bays-model')!;
    stageSheets.length = 0;
    stageSheets[1] = { img: 'data:image/jpeg;base64,AAAA', labels: [{ text: 'Headland: worn back 140 m <hard>', xM: 0, yM: 0 }, { text: 'Secret', xM: 0, yM: 0, answer: true }] };
    const student = lessonSheetHtml(lesson, 'ks3', false);
    for (const st of lesson.stages) expect(student).toContain(st.ks3.replace(/&/g, '&amp;').slice(0, 40));
    expect(student).toContain('Headland: worn back 140 m &lt;hard&gt;'); // escaped
    expect(student).not.toContain('Secret');
    expect(student).toContain('Show this stage in the lesson'); // stages not shown yet
    expect(student).toContain(lesson.exam!.question.replace(/&/g, '&amp;'));
    expect(student).not.toContain('Model answer:');
    const teacher = lessonSheetHtml(lesson, 'gcse', true);
    expect(teacher).toContain('Model answer:');
    expect(teacher).toContain('Secret');
    expect(teacher).toContain(lesson.stages[0].gcse.slice(0, 40));
    stageSheets.length = 0;
  });
});
