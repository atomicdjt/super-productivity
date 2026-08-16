import { Action, ActionReducer } from '@ngrx/store';
import { RootState } from '../../root-state';
import { WorkContextType } from '../../../features/work-context/work-context.model';
import {
  moveTaskDownInTodayList,
  moveTaskToBottomInTodayList,
  moveTaskToTopInTodayList,
  moveTaskUpInTodayList,
} from '../../../features/work-context/store/work-context-meta.actions';
import { SECTION_FEATURE_NAME } from '../../../features/section/store/section.reducer';
import { SectionState } from '../../../features/section/section.model';
import { TASK_FEATURE_NAME } from '../../../features/tasks/store/task.reducer';
import { PROJECT_FEATURE_NAME } from '../../../features/project/store/project.reducer';
import { TAG_FEATURE_NAME } from '../../../features/tag/store/tag.reducer';
import { sectionSharedMetaReducer } from './section-shared.reducer';
import { createBaseState, createMockTask } from './test-utils';

const TASK_IDS = ['t1', 't2', 't3'];

type StateWithSections = RootState & {
  [SECTION_FEATURE_NAME]: SectionState;
};

const createState = (
  contextType: WorkContextType = WorkContextType.PROJECT,
  contextId: string = 'project1',
): StateWithSections => {
  const base = createBaseState();
  const tasks = Object.fromEntries(
    TASK_IDS.map((id) => [
      id,
      createMockTask({
        id,
        projectId: contextType === WorkContextType.PROJECT ? contextId : undefined,
        tagIds: contextType === WorkContextType.TAG ? [contextId] : [],
      }),
    ]),
  );

  const state = {
    ...base,
    [TASK_FEATURE_NAME]: {
      ...base[TASK_FEATURE_NAME],
      ids: [...TASK_IDS],
      entities: tasks,
    },
    [SECTION_FEATURE_NAME]: {
      ids: ['section1', 'section2'],
      entities: {
        section1: {
          id: 'section1',
          contextId,
          contextType,
          title: 'Section 1',
          taskIds: [...TASK_IDS],
        },
        section2: {
          id: 'section2',
          contextId,
          contextType,
          title: 'Section 2',
          taskIds: ['other'],
        },
      },
    },
  } as StateWithSections;

  if (contextType === WorkContextType.PROJECT) {
    const project = state[PROJECT_FEATURE_NAME].entities[contextId];
    if (!project) throw new Error(`Missing project fixture: ${contextId}`);
    state[PROJECT_FEATURE_NAME] = {
      ...state[PROJECT_FEATURE_NAME],
      entities: {
        ...state[PROJECT_FEATURE_NAME].entities,
        [contextId]: { ...project, taskIds: [...TASK_IDS] },
      },
    };
  } else {
    const tag = state[TAG_FEATURE_NAME].entities[contextId];
    if (!tag) throw new Error(`Missing tag fixture: ${contextId}`);
    state[TAG_FEATURE_NAME] = {
      ...state[TAG_FEATURE_NAME],
      entities: {
        ...state[TAG_FEATURE_NAME].entities,
        [contextId]: { ...tag, taskIds: [...TASK_IDS] },
      },
    };
  }

  return state;
};

describe('sectionSharedMetaReducer section reorder regression #9574', () => {
  let mockReducer: jasmine.Spy;
  let metaReducer: ActionReducer<RootState, Action>;

  beforeEach(() => {
    mockReducer = jasmine.createSpy('reducer').and.callFake((state) => state);
    metaReducer = sectionSharedMetaReducer(mockReducer);
  });

  const forwardedSectionTaskIds = (): string[] => {
    const forwarded = mockReducer.calls.mostRecent().args[0] as StateWithSections;
    return forwarded[SECTION_FEATURE_NAME].entities.section1?.taskIds ?? [];
  };

  it('moves a task to the bottom of its section in the same reducer pass', () => {
    const state = createState();

    metaReducer(
      state,
      moveTaskToBottomInTodayList({
        taskId: 't1',
        workContextType: WorkContextType.PROJECT,
        workContextId: 'project1',
        doneTaskIds: [],
      }),
    );

    expect(forwardedSectionTaskIds()).toEqual(['t2', 't3', 't1']);
  });

  it('moves a task to the top of its section in the same reducer pass', () => {
    const state = createState();

    metaReducer(
      state,
      moveTaskToTopInTodayList({
        taskId: 't3',
        workContextType: WorkContextType.PROJECT,
        workContextId: 'project1',
        doneTaskIds: [],
      }),
    );

    expect(forwardedSectionTaskIds()).toEqual(['t3', 't1', 't2']);
  });

  it('moves a task up within its section', () => {
    const state = createState();

    metaReducer(
      state,
      moveTaskUpInTodayList({
        taskId: 't2',
        workContextType: WorkContextType.PROJECT,
        workContextId: 'project1',
        doneTaskIds: [],
      }),
    );

    expect(forwardedSectionTaskIds()).toEqual(['t2', 't1', 't3']);
  });

  it('moves a task down within its section', () => {
    const state = createState();

    metaReducer(
      state,
      moveTaskDownInTodayList({
        taskId: 't2',
        workContextType: WorkContextType.PROJECT,
        workContextId: 'project1',
        doneTaskIds: [],
      }),
    );

    expect(forwardedSectionTaskIds()).toEqual(['t1', 't3', 't2']);
  });

  it('applies the same section ordering behavior in tag contexts', () => {
    const state = createState(WorkContextType.TAG, 'tag1');

    metaReducer(
      state,
      moveTaskToBottomInTodayList({
        taskId: 't1',
        workContextType: WorkContextType.TAG,
        workContextId: 'tag1',
        doneTaskIds: [],
      }),
    );

    expect(forwardedSectionTaskIds()).toEqual(['t2', 't3', 't1']);
  });

  it('leaves other sections untouched when they do not contain the moved task', () => {
    const state = createState();

    metaReducer(
      state,
      moveTaskToBottomInTodayList({
        taskId: 't1',
        workContextType: WorkContextType.PROJECT,
        workContextId: 'project1',
        doneTaskIds: [],
      }),
    );

    const forwarded = mockReducer.calls.mostRecent().args[0] as StateWithSections;
    expect(forwarded[SECTION_FEATURE_NAME].entities.section2?.taskIds).toEqual(['other']);
  });
});
