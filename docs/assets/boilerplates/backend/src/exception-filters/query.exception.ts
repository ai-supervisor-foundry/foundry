import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

const queryFailedMessages = {
  'duplicate key value violates unique constraint': {
    statusCode: HttpStatus.CONFLICT,
    message: 'Already exists',
    resolver: (exception: any) => {
      return exception.detail;
    },
  },
};

@Catch(QueryFailedError)
export class QueryExceptionFilter implements ExceptionFilter {
  catch(exception: QueryFailedError, host: ArgumentsHost) {
    console.log(exception);
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    // eslint-disable-next-line prettier/prettier
    const matchedErrorKeys = Object
      .keys(queryFailedMessages)
      .filter((key) =>
      // eslint-disable-next-line prettier/prettier
        exception.message
          .toLowerCase()
          .includes(key.toLowerCase()),
    );
    if (!matchedErrorKeys.length) {
      console.log(exception);
      return response.status(500).json({
        statusCode: 500,
        message: 'some error occurred',
      });
    }
    const matchedMessage = matchedErrorKeys.map(
      (key) => queryFailedMessages[key],
    );

    const [firstMessage] = matchedMessage;

    if (process.env.NODE_ENV === 'development') {
      console.log(`currentException:`);
      console.log(exception);
      console.log(`matchedErrorKeys:`);
      console.log(matchedErrorKeys);
    }

    // eslint-disable-next-line prettier/prettier
    response
      .status(firstMessage.statusCode ?? 400).json({
      statusCode: firstMessage.statusCode ?? 4001,
      message: firstMessage?.resolver(exception) ?? firstMessage.message,
    });
  }
}
