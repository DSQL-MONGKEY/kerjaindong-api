import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CompanyContext } from '../guards/company-access.guard';

export const CurrentCompany = createParamDecorator(
  (_: undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();

    return request.companyContext as CompanyContext | undefined;
  },
);
