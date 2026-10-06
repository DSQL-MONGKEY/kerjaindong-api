import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

function runInterceptor(value: unknown) {
  const interceptor = new TransformInterceptor();
  const next = { handle: () => of(value) } as CallHandler;

  return firstValueFrom(interceptor.intercept({} as ExecutionContext, next));
}

describe('TransformInterceptor', () => {
  it('wraps plain payloads in { success, data }', async () => {
    await expect(runInterceptor({ id: 1 })).resolves.toEqual({
      success: true,
      data: { id: 1 },
    });
  });

  it('passes through payloads that already carry data or message', async () => {
    await expect(runInterceptor({ data: [1, 2] })).resolves.toEqual({
      data: [1, 2],
    });
    await expect(runInterceptor({ message: 'ok' })).resolves.toEqual({
      message: 'ok',
    });
  });

  it('re-wraps falsy data/message values (truthiness check)', async () => {
    await expect(runInterceptor({ data: 0 })).resolves.toEqual({
      success: true,
      data: { data: 0 },
    });
    await expect(runInterceptor({ message: '' })).resolves.toEqual({
      success: true,
      data: { message: '' },
    });
  });

  it('wraps null and undefined payloads', async () => {
    await expect(runInterceptor(null)).resolves.toEqual({
      success: true,
      data: null,
    });
    await expect(runInterceptor(undefined)).resolves.toEqual({
      success: true,
      data: undefined,
    });
  });
});
