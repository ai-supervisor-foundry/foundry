import { parseCursorOutput, ParsedOutput } from '../../../src/domain/agents/outputParser';

describe('OutputParser', () => {
  describe('parseCursorOutput', () => {
    describe('Valid JSON extraction', () => {
      it('should extract JSON from code block', () => {
        const raw = '```json\n{"status": "success", "message": "Task completed"}\n```';
        const result = parseCursorOutput(raw);
        expect(result).toEqual({ status: 'success', message: 'Task completed' });
      });

      it('should extract JSON from code block with whitespace', () => {
        const raw = '```json\n\n  {"status": "success"}  \n\n```';
        const result = parseCursorOutput(raw);
        expect(result).toEqual({ status: 'success' });
      });

      it('should extract plain JSON object without code block', () => {
        const raw = '{"status": "success", "count": 42}';
        const result = parseCursorOutput(raw);
        expect(result).toEqual({ status: 'success', count: 42 });
      });

      it('should handle nested JSON objects', () => {
        const raw = '```json\n{"data": {"nested": {"value": true}}}\n```';
        const result = parseCursorOutput(raw);
        expect(result).toEqual({ data: { nested: { value: true } } });
      });

      it('should handle JSON with arrays', () => {
        const raw = '{"items": [1, 2, 3], "tags": ["a", "b"]}';
        const result = parseCursorOutput(raw);
        expect(result).toEqual({ items: [1, 2, 3], tags: ['a', 'b'] });
      });

      it('should handle JSON with special characters', () => {
        const raw = '```json\n{"message": "Line 1\\nLine 2", "path": "src/test.ts"}\n```';
        const result = parseCursorOutput(raw);
        expect(result).toEqual({ message: 'Line 1\nLine 2', path: 'src/test.ts' });
      });

      it('should handle empty object', () => {
        const raw = '{}';
        const result = parseCursorOutput(raw);
        expect(result).toEqual({});
      });

      it('should handle JSON with null values', () => {
        const raw = '{"value": null, "exists": false}';
        const result = parseCursorOutput(raw);
        expect(result).toEqual({ value: null, exists: false });
      });
    });

    describe('Trailing text detection (security)', () => {
      it('should reject trailing text after JSON code block', () => {
        const raw = '```json\n{"status": "success"}\n```\nExtra text here';
        expect(() => parseCursorOutput(raw)).toThrow('Trailing text after JSON block is not allowed');
      });

      it('should reject text before plain JSON object', () => {
        const raw = 'Here is the result: {"status": "success"}';
        expect(() => parseCursorOutput(raw)).toThrow('Trailing text around JSON object is not allowed');
      });

      it('should reject text after plain JSON object', () => {
        const raw = '{"status": "success"} - additional comment';
        expect(() => parseCursorOutput(raw)).toThrow('Trailing text around JSON object is not allowed');
      });

      it('should reject text both before and after JSON', () => {
        const raw = 'Prefix {"status": "success"} Suffix';
        expect(() => parseCursorOutput(raw)).toThrow('Trailing text around JSON object is not allowed');
      });

      it('should reject multiple JSON objects', () => {
        const raw = '{ "first": 1} {"second": 2}';
        // This will fail due to malformed JSON (parsing stops after first object)
        expect(() => parseCursorOutput(raw)).toThrow();
      });
    });

    describe('Required keys validation', () => {
      it('should pass when all required keys are present', () => {
        const raw = '{"status": "success", "message": "Done", "count": 5}';
        const result = parseCursorOutput(raw, { requiredKeys: ['status', 'message'] });
        expect(result).toEqual({ status: 'success', message: 'Done', count: 5 });
      });

      it('should throw when required key is missing', () => {
        const raw = '{"status": "success"}';
        expect(() => parseCursorOutput(raw, { requiredKeys: ['status', 'message'] }))
          .toThrow('Missing required keys: message');
      });

      it('should throw when multiple required keys are missing', () => {
        const raw = '{"count": 5}';
        expect(() => parseCursorOutput(raw, { requiredKeys: ['status', 'message', 'result'] }))
          .toThrow('Missing required keys: status, message, result');
      });

      it('should pass when no required keys specified', () => {
        const raw = '{"any": "value"}';
        const result = parseCursorOutput(raw, { requiredKeys: [] });
        expect(result).toEqual({ any: 'value' });
      });

      it('should pass when required keys have falsy values', () => {
        const raw = '{"status": false, "count": 0, "message": ""}';
        const result = parseCursorOutput(raw, { requiredKeys: ['status', 'count', 'message'] });
        expect(result).toEqual({ status: false, count: 0, message: '' });
      });

      it('should detect missing key even with null value', () => {
        const raw = '{"status": null}';
        const result = parseCursorOutput(raw, { requiredKeys: ['status'] });
        expect(result.status).toBeNull();
      });
    });

    describe('Malformed JSON handling', () => {
      it('should reject invalid JSON syntax', () => {
        const raw = '{"status": "success"'; // Missing closing brace
        expect(() => parseCursorOutput(raw)).toThrow('Malformed JSON');
      });

      it('should reject JSON with trailing commas', () => {
        const raw = '{"status": "success",}';
        expect(() => parseCursorOutput(raw)).toThrow('Malformed JSON');
      });

      it('should reject JSON with unquoted keys', () => {
        const raw = '{status: "success"}';
        expect(() => parseCursorOutput(raw)).toThrow('Malformed JSON');
      });

      it('should reject JSON with single quotes', () => {
        const raw = "{'status': 'success'}";
        expect(() => parseCursorOutput(raw)).toThrow('Malformed JSON');
      });

      it('should reject incomplete JSON in code block', () => {
        const raw = '```json\n{"status":\n```';
        expect(() => parseCursorOutput(raw)).toThrow('Malformed JSON');
      });

      it('should reject non-JSON text', () => {
        const raw = 'This is just plain text, not JSON';
        expect(() => parseCursorOutput(raw)).toThrow();
      });

      it('should reject empty string', () => {
        const raw = '';
        expect(() => parseCursorOutput(raw)).toThrow('Input must be a non-empty string');
      });

      it('should reject null input', () => {
        expect(() => parseCursorOutput(null as any)).toThrow('Input must be a non-empty string');
      });

      it('should reject undefined input', () => {
        expect(() => parseCursorOutput(undefined as any)).toThrow('Input must be a non-empty string');
      });
    });

    describe('Type validation', () => {
      it('should reject JSON array at root level', () => {
        const raw = '[1, 2, 3]';
        expect(() => parseCursorOutput(raw)).toThrow('Parsed JSON must be an object');
      });

      it('should reject JSON string at root level', () => {
        const raw = '"just a string"';
        expect(() => parseCursorOutput(raw)).toThrow('Parsed JSON must be an object');
      });

      it('should reject JSON number at root level', () => {
        const raw = '42';
        expect(() => parseCursorOutput(raw)).toThrow('Parsed JSON must be an object');
      });

      it('should reject JSON boolean at root level', () => {
        const raw = 'true';
        expect(() => parseCursorOutput(raw)).toThrow('Parsed JSON must be an object');
      });

      it('should reject JSON null at root level', () => {
        const raw = 'null';
        expect(() => parseCursorOutput(raw)).toThrow('Parsed JSON must be an object');
      });

      it('should accept array in code block but reject as root', () => {
        const raw = '```json\n[{"item": 1}]\n```';
        expect(() => parseCursorOutput(raw)).toThrow('Parsed JSON must be an object');
      });
    });

    describe('Edge cases', () => {
      it('should handle very large JSON objects', () => {
        const largeObj: Record<string, number> = {};
        for (let i = 0; i < 1000; i++) {
          largeObj[`key${i}`] = i;
        }
        const raw = JSON.stringify(largeObj);
        const result = parseCursorOutput(raw);
        expect(Object.keys(result).length).toBe(1000);
        expect(result['key500']).toBe(500);
      });

      it('should handle deeply nested objects', () => {
        let nested: any = { value: 'end' };
        for (let i = 0; i < 10; i++) {
          nested = { level: i, child: nested };
        }
        const raw = JSON.stringify(nested);
        const result = parseCursorOutput(raw);
        expect(result.level).toBe(9);
      });

      it('should handle JSON with Unicode characters', () => {
        const raw = '{"emoji": "🎉", "chinese": "你好", "arabic": "مرحبا"}';
        const result = parseCursorOutput(raw);
        expect(result).toEqual({ emoji: '🎉', chinese: '你好', arabic: 'مرحبا' });
      });

      it('should handle JSON with escaped quotes', () => {
        const raw = '{"quote": "He said \\"Hello\\""}';
        const result = parseCursorOutput(raw);
        expect(result).toEqual({ quote: 'He said "Hello"' });
      });

      it('should handle JSON with mixed whitespace in code block', () => {
        const raw = '```json\n\t  {\n\t\t"status": "success"\n\t  }\n  ```';
        const result = parseCursorOutput(raw);
        expect(result).toEqual({ status: 'success' });
      });

      it('should preserve numeric precision', () => {
        const raw = '{"int": 42, "float": 3.14159, "exp": 1.23e-10}';
        const result = parseCursorOutput(raw);
        expect(result.int).toBe(42);
        expect(result.float).toBe(3.14159);
        expect(result.exp).toBe(1.23e-10);
      });
    });

    describe('Security considerations', () => {
      it('should not execute JavaScript code in JSON', () => {
        const raw = '{"func": "function() { return 42; }"}';
        const result = parseCursorOutput(raw);
        expect(typeof result.func).toBe('string');
        expect(result.func).toBe('function() { return 42; }');
      });

      it('should handle potentially malicious keys safely', () => {
        const raw = '{"__proto__": "polluted", "constructor": "hacked"}';
        const result = parseCursorOutput(raw);
        expect(result.__proto__).toBe('polluted');
        expect(result.constructor).toBe('hacked');
      });

      it('should reject code block with JavaScript after JSON', () => {
        const raw = '```json\n{"status": "success"}\n```\nconsole.log("hack");';
        expect(() => parseCursorOutput(raw)).toThrow('Trailing text after JSON block is not allowed');
      });
    });
  });
});
