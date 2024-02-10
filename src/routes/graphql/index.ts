import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import { buildSchema, graphql } from 'graphql';
import { QueryDocumentKeys } from 'graphql/language/ast.js';


const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { prisma } = fastify;
  /*
  fastify.route({
    url: '/',
    method: 'POST',
    schema: {
      ...createGqlResponseSchema,
      response: {
        200: gqlResponseSchema,
      },
    },
    async handler(req) {
      console.log('зашли в /graphql!!!! ');
      //return {};
      return { data: 55555, exampre: 77777777 };
    },
  });
*/


  fastify.route({
    url: '/',
    method: 'POST',
    schema: {
      ...createGqlResponseSchema,
      response: {
        200: gqlResponseSchema,
      },
    },
    async handler(req) {
      console.log('зашли в handler graphql !!!!!!!')
      const result = graphql({
        schema,
        source: req.body.query,
        rootValue: resolvers,
      });
      /*
      const memberTypes = await prisma.memberType.findMany();
      const posts = await prisma.post.findMany();
      const users = await prisma.user.findMany();
      const profiles = await prisma.profile.findMany();
      const result = {
        data: {
          memberTypes,
          posts,
          users,
          profiles,
        }
      }
      */
      return result;
      //return { data: 55555, example: 77777777 };

      /*
      const graphqlArgs = {
        schema: req.body,
        source: 'qqqqqqq',
      }
      return graphql(graphqlArgs);
      */
    },
  });

  const resolvers = {
    memberTypes: () => prisma.memberType.findMany(),
    posts: () => prisma.post.findMany(),
    users: () => prisma.user.findMany(),
    profiles: () => prisma.profile.findMany(),
  }

};

export default plugin;


const schema = buildSchema(`
  type Query {
    memberTypes: [MemberType]
    posts: [Post]
    users: [User]
    profiles: [Profile]
  }

  type MemberType {
    id: String
    discount: Float
    postsLimitPerMonth: Int
  }

  type Post {
    id: String
    title: String
    content: String
  }

  type User {
    id: String
    name: String
    balance: Float
  }

  type Profile {
    id: String
    isMale: Boolean
    yearOfBirth: Int
  }
`);

/*

export interface GraphQLArgs {
  schema: GraphQLSchema;
  source: string | Source;
  rootValue?: unknown;
  contextValue?: unknown;
  variableValues?: Maybe<{
    readonly [variable: string]: unknown;
  }>;
  operationName?: Maybe<string>;
  fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
  typeResolver?: Maybe<GraphQLTypeResolver<any, any>>;
}*/