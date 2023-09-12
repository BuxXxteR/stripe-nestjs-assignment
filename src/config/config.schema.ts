import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().required(),
  PORT: Joi.number().default(5000).required(),

  DB_TYPE: Joi.string().required(),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306).required(),
  DB_USERNAME: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  // DB_REGION: Joi.string().required(),
  // DB_READER_HOST: Joi.string().required(),
  // DB_WRITER_HOST: Joi.string().required(),

  STRIPE_SK: Joi.string().required(),
  STRIPE_WEBHOOK_ENDPOINT_SK: Joi.string().required(),
  STRIPE_USE_TEST_MODE: Joi.string().required(),
});
