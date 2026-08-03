import test from 'node:test'
import assert from 'node:assert/strict'
import { pollDefect, findPlanDefects, formatDefectAlert } from './plan-lint-core.mjs'

const ok = { type: 'poll', date: '2026-08-09', title: 'Опрос', poll_options: ['А', 'Б'] }

test('a well-formed poll has no defect', () => {
  assert.equal(pollDefect(ok), null)
})

test('the field that shipped missing twice is caught', () => {
  assert.match(pollDefect({ ...ok, poll_options: undefined }), /нет poll_options/)
  assert.match(pollDefect({ ...ok, poll_options: [] }), /нет poll_options/)
})

test('Telegram limits are enforced on both ends', () => {
  assert.match(pollDefect({ ...ok, poll_options: ['один'] }), /минимум 2/)
  assert.match(pollDefect({ ...ok, poll_options: Array(13).fill('да') }), /не больше 12/)
  assert.match(pollDefect({ ...ok, poll_options: ['А', 'я'.repeat(101)] }), /длиннее 100/)
  assert.match(pollDefect({ ...ok, poll_options: ['А', '  '] }), /пустая опция/)
})

test('only unsent polls still ahead of us are reported', () => {
  const posts = [
    { ...ok, date: '2026-08-02', poll_options: undefined },           // прошедший — не спасти
    { ...ok, date: '2026-08-09', poll_options: undefined, sent: true }, // уже ушёл
    { ...ok, date: '2026-08-16', poll_options: undefined },           // вот этот
    { type: 'guide', date: '2026-08-17', title: 'Гайд' },             // не опрос
  ]
  const found = findPlanDefects(posts, '2026-08-03')
  assert.equal(found.length, 1)
  assert.equal(found[0].date, '2026-08-16')
})

test("today's own poll still counts — the cron runs before it is sent", () => {
  assert.equal(findPlanDefects([{ ...ok, date: '2026-08-03', poll_options: [] }], '2026-08-03').length, 1)
})

test('a plan with nothing wrong produces nothing', () => {
  assert.deepEqual(findPlanDefects([ok], '2026-08-01'), [])
  assert.deepEqual(findPlanDefects(undefined, '2026-08-01'), [])
})

test('the alert names the file, the dates and the reason', () => {
  const text = formatDefectAlert(
    findPlanDefects([{ ...ok, date: '2026-08-16', poll_options: [] }], '2026-08-03'),
    'content-plan-august-2026.json',
  )
  assert.match(text, /content-plan-august-2026\.json/)
  assert.match(text, /2026-08-16/)
  assert.match(text, /нет poll_options/)
})
