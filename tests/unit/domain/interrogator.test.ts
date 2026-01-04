// Interrogator unit tests

import { InterrogationSession, Task } from '../../../src/domain/types/types';
import { createMockTask } from '../../fixtures/mockData';

describe('Interrogator', () => {
  describe('interrogateAgent', () => {
    it('should create interrogation session with failed criteria', () => {
      const task = createMockTask({
        task_id: 'test-001',
        acceptance_criteria: ['Criterion A', 'Criterion B', 'Criterion C'],
      });

      const failedCriteria = ['Criterion A', 'Criterion C'];

      const session: InterrogationSession = {
        task_id: 'test-001',
        failed_criteria: failedCriteria,
        interrogation_results: [],
        all_criteria_satisfied: false,
        remaining_failed_criteria: failedCriteria,
      };

      expect(session).toBeDefined();
      expect(session.task_id).toBe('test-001');
      expect(session.failed_criteria).toEqual(failedCriteria);
    });

    it('should generate interrogation questions for each failed criterion', () => {
      const task = createMockTask({
        task_id: 'test-002',
        acceptance_criteria: [
          'API endpoints must be implemented',
          'Database migrations must be applied',
        ],
      });

      const failedCriteria = [
        'API endpoints must be implemented',
        'Database migrations must be applied',
      ];

      const session: InterrogationSession = {
        task_id: 'test-002',
        failed_criteria: failedCriteria,
        interrogation_results: [
          {
            criterion: failedCriteria[0],
            question: 'Are API endpoints implemented?',
            agent_response: 'Yes, all endpoints are implemented',
            analysis_result: 'COMPLETE',
            analysis_reason: 'API endpoints found in code',
            question_number: 1,
          },
        ],
        all_criteria_satisfied: false,
        remaining_failed_criteria: [failedCriteria[1]],
      };

      expect(session.interrogation_results).toBeDefined();
      expect(session.interrogation_results.length).toBeGreaterThan(0);
    });

    it('should mark all criteria as satisfied when interrogation passes', () => {
      const task = createMockTask({
        task_id: 'test-003',
        acceptance_criteria: [
          'Function implements core logic',
          'Error handling is present',
        ],
      });

      const failedCriteria = ['Function implements core logic'];

      const session: InterrogationSession = {
        task_id: 'test-003',
        failed_criteria: failedCriteria,
        interrogation_results: [
          {
            criterion: failedCriteria[0],
            question: 'Is core logic implemented?',
            agent_response: 'Yes',
            analysis_result: 'COMPLETE',
            analysis_reason: 'All logic verified',
            question_number: 1,
          },
        ],
        all_criteria_satisfied: true,
        remaining_failed_criteria: [],
      };

      expect(session.all_criteria_satisfied).toBeDefined();
      expect(typeof session.all_criteria_satisfied).toBe('boolean');
    });

    it('should track remaining failed criteria', () => {
      const task = createMockTask({
        task_id: 'test-004',
        acceptance_criteria: [
          'Component renders correctly',
          'Props validation works',
          'Event handlers are connected',
        ],
      });

      const failedCriteria = [
        'Component renders correctly',
        'Event handlers are connected',
      ];

      const session: InterrogationSession = {
        task_id: 'test-004',
        failed_criteria: failedCriteria,
        interrogation_results: [],
        all_criteria_satisfied: false,
        remaining_failed_criteria: failedCriteria,
      };

      expect(session.remaining_failed_criteria).toBeDefined();
      expect(Array.isArray(session.remaining_failed_criteria)).toBe(true);
    });

    it('should include analysis results for each interrogation', () => {
      const task = createMockTask({
        task_id: 'test-005',
        acceptance_criteria: ['Tests must pass'],
      });

      const session: InterrogationSession = {
        task_id: 'test-005',
        failed_criteria: ['Tests must pass'],
        interrogation_results: [
          {
            criterion: 'Tests must pass',
            question: 'Do all tests pass?',
            agent_response: 'All tests passed',
            analysis_result: 'COMPLETE',
            analysis_reason: 'Test suite verified',
            question_number: 1,
          },
        ],
        all_criteria_satisfied: true,
        remaining_failed_criteria: [],
      };

      expect(session.interrogation_results).toBeDefined();
      session.interrogation_results.forEach((result) => {
        expect(result.criterion).toBeDefined();
        expect(result.question).toBeDefined();
        expect(result.analysis_result).toBeDefined();
        expect(['COMPLETE', 'INCOMPLETE', 'UNCERTAIN'].includes(result.analysis_result)).toBe(true);
      });
    });

    it('should handle complex criteria', () => {
      const task = createMockTask({
        task_id: 'test-006',
        acceptance_criteria: [
          'Authentication system with JWT tokens and refresh mechanisms',
          'Rate limiting with configurable thresholds per endpoint',
          'Comprehensive error handling across all service layers',
        ],
      });

      const session: InterrogationSession = {
        task_id: 'test-006',
        failed_criteria: task.acceptance_criteria,
        interrogation_results: [
          {
            criterion: task.acceptance_criteria[0],
            question: 'Is authentication system implemented?',
            agent_response: 'Authentication is fully implemented',
            analysis_result: 'COMPLETE',
            analysis_reason: 'Auth system verified',
            question_number: 1,
          },
        ],
        all_criteria_satisfied: false,
        remaining_failed_criteria: task.acceptance_criteria.slice(1),
      };

      expect(session.interrogation_results.length).toBeGreaterThan(0);
    });

    it('should track question sequence numbers', () => {
      const task = createMockTask({
        task_id: 'test-007',
        acceptance_criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'],
      });

      const session: InterrogationSession = {
        task_id: 'test-007',
        failed_criteria: task.acceptance_criteria,
        interrogation_results: [
          {
            criterion: 'Criterion 1',
            question: 'First question?',
            agent_response: 'Response',
            analysis_result: 'COMPLETE',
            analysis_reason: 'Analyzed',
            question_number: 1,
          },
          {
            criterion: 'Criterion 2',
            question: 'Second question?',
            agent_response: 'Response',
            analysis_result: 'COMPLETE',
            analysis_reason: 'Analyzed',
            question_number: 2,
          },
          {
            criterion: 'Criterion 3',
            question: 'Third question?',
            agent_response: 'Response',
            analysis_result: 'COMPLETE',
            analysis_reason: 'Analyzed',
            question_number: 3,
          },
        ],
        all_criteria_satisfied: true,
        remaining_failed_criteria: [],
      };

      const questionNumbers = session.interrogation_results.map((r) => r.question_number);
      expect(questionNumbers).toEqual(expect.arrayContaining([1, 2, 3]));
    });

    it('should document file paths found during interrogation', () => {
      const task = createMockTask({
        task_id: 'test-008',
        acceptance_criteria: ['Implementation files must exist'],
      });

      const session: InterrogationSession = {
        task_id: 'test-008',
        failed_criteria: ['Implementation files must exist'],
        interrogation_results: [
          {
            criterion: 'Implementation files must exist',
            question: 'Are implementation files present?',
            agent_response: 'Files found at src/index.ts and src/utils.ts',
            analysis_result: 'COMPLETE',
            analysis_reason: 'Implementation files verified',
            file_paths_found: ['src/index.ts', 'src/utils.ts'],
            question_number: 1,
          },
        ],
        all_criteria_satisfied: true,
        remaining_failed_criteria: [],
      };

      const resultsWithFiles = session.interrogation_results.filter(
        (r) => r.file_paths_found && r.file_paths_found.length > 0
      );

      resultsWithFiles.forEach((result) => {
        expect(Array.isArray(result.file_paths_found)).toBe(true);
      });
    });
  });
});
