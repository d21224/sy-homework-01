import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../english-listening-homework.html', import.meta.url), 'utf8');
const helpers = source.match(/\/\* TESTABLE_STATE_START \*\/([\s\S]*?)\/\* TESTABLE_STATE_END \*\//)?.[1];

if (!helpers) throw new Error('학습 상태 테스트용 함수 영역을 찾지 못했습니다.');

const sandbox = {};
vm.runInNewContext(`${helpers}\nglobalThis.learningHelpers={isActiveDay,getActiveLearningItems,getProgress,isToday,isWeekComplete,resetWeeklyProgress};`, sandbox);
const { isActiveDay, getActiveLearningItems, getProgress, isToday, isWeekComplete, resetWeeklyProgress } = sandbox.learningHelpers;

const learningState = (days, tasks = [], taskDone = []) => ({ days, tasks, taskDone });
const day = (target, count = 0) => ({ target, count });

test('목표 횟수 0인 요일은 학습 항목과 진행률에서 제외한다', () => {
  const state = learningState([day(3, 1), day(0, 0), day(2, 2)], ['워크시트'], [false]);

  assert.equal(isActiveDay(state.days[1]), false);
  assert.deepEqual(Array.from(getActiveLearningItems(state), item => item.type + item.index), ['day0', 'day2', 'task0']);
  assert.deepEqual({ ...getProgress(state) }, { done: 1, total: 3 });
});

test('평일 듣기와 주간 과제를 합쳐 전체 진행률을 계산한다', () => {
  const state = learningState([day(1, 1), day(2, 1)], ['읽기', '롤플레이'], [true, false]);

  assert.deepEqual({ ...getProgress(state) }, { done: 2, total: 4 });
  assert.equal(isWeekComplete(getProgress(state)), false);
});

test('학습 항목이 하나도 없으면 주간 완주로 표시하지 않는다', () => {
  assert.deepEqual({ ...getProgress(learningState([day(0), day(0)])) }, { done: 0, total: 0 });
  assert.equal(isWeekComplete({ done: 0, total: 0 }), false);
});

test('월요일부터 금요일까지 오늘 표시를 정확히 계산한다', () => {
  const monday = new Date(2026, 6, 27, 12);
  const friday = new Date(2026, 6, 31, 12);

  assert.equal(isToday(0, monday), true);
  assert.equal(isToday(4, monday), false);
  assert.equal(isToday(4, friday), true);
});

test('새 주 시작은 설정을 유지하고 완료 기록과 포인트만 초기화한다', () => {
  const original = {
    ...learningState([ { ...day(2, 2), points: 200, completedAt: '2026-07-27', celebration: '최고!' } ], ['읽기'], [true]),
    theme: 'dark',
    parentPassword: '1234',
    rewards: { dailyPoints: 200, weeklyPoints: 500, weeklyEarned: 500, weeklyCompletedAt: '2026-07-30' },
  };
  const reset = resetWeeklyProgress(original);

  assert.equal(reset.theme, 'dark');
  assert.equal(reset.parentPassword, '1234');
  assert.deepEqual({ ...reset.days[0] }, { target: 2, count: 0, points: 0, completedAt: '', celebration: '' });
  assert.deepEqual(Array.from(reset.taskDone), [false]);
  assert.equal(reset.rewards.dailyPoints, 200);
  assert.equal(reset.rewards.weeklyEarned, 0);
  assert.equal(reset.rewards.weeklyCompletedAt, '');
});
