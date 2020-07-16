import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as express from 'express';
import * as functions from 'firebase-functions';

import { AppModule } from './app.module';

const expressServer = express();

const createFunction = async (
  expressInstance: Express.Application,
): Promise<void> => {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressInstance),
  );

  const options = new DocumentBuilder()
    .setTitle('@cougargrades/api')
    .setDescription('description')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, options);
  console.log(document)
  //SwaggerModule.setup('/docs', app, document);

  await app.init();
};

export const api = functions.https.onRequest(async (request, response) => {
  await createFunction(expressServer);
  expressServer(request, response);
});
