import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import { buildSchema, graphql } from 'graphql';
import { GraphQLID } from 'graphql';
import { QueryDocumentKeys } from 'graphql/language/ast.js';
import { UUIDType } from './types/uuid.js';


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
      //console.log('req.body.variables ', req.body.variables);      
      const result = graphql({
        schema,
        source: req.body.query,
        variableValues: req.body.variables,
        rootValue: resolvers,
        contextValue: fastify,
        //typeResolver: typeResolvers,
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


  //const UUID =UUIDType;

  const resolvers = {
    memberTypes: async () => await prisma.memberType.findMany(),
    posts: async () => await prisma.post.findMany(),
    users: async () => {
      const users = await prisma.user.findMany();
      return users.map(async (item) => await getUserData(item));
    },
    profiles: async () => {
      const profiles = await prisma.profile.findMany();
      return profiles.map(async (item) => await getProfileData(item));
    },

    memberType: async (args) => {
      const result = await prisma.memberType.findUnique({ where: { id: args.id } })
      return result || null
    },
    post: async (args) => {
      const result = await prisma.post.findUnique({ where: { id: args.id } })
      return result || null
    },
    user: async (args) => {
      const user = await prisma.user.findUnique({ where: { id: args.id } })
      if (user) {
        return await getUserData(user);
        /*
        const profile = await prisma.profile.findUnique({ where: { userId: result.id } });
        console.log('1111111111 profile  ', profile);
        
        const posts = await prisma.post.findMany({ where: { authorId: result.id } });
        return {
          id: result.id,
          name: result.name,
          balance: result.balance,
          profile,
          posts,
        }
        */
      } else {
        return null;
      }
      //return result || null
    },
    profile: async (args) => {
      const profile = await prisma.profile.findUnique({ where: { id: args.id } })
      if (profile) {
        return await getProfileData(profile);
        /*
        const memberType = await prisma.memberType.findUnique({ where: { id: result.memberTypeId } })
        return {
          id: result.id,
          isMale: result.isMale,
          yearOfBirth: result.yearOfBirth,
          memberType,
        }
        */
      } else {
        return null;
      }
      //return result || null
    },
  }

  const getUserData = async (user) => {
    const posts = await prisma.post.findMany({ where: { authorId: user.id } });
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    const profileData = await getProfileData(profile);
    return {
      id: user.id,
      name: user.name,
      balance: user.balance,
      profile: profileData,
      posts,
    }
  }

  const getProfileData = async (profile) => {
    if (profile) {
      const memberType = await prisma.memberType.findUnique({ where: { id: profile.memberTypeId } })
      return {
        id: profile.id,
        isMale: profile.isMale,
        yearOfBirth: profile.yearOfBirth,
        memberType,
      }
    } else {
      return null;
    }
  }

  //const typeResolvers = {
  //  UUID: UUIDType,
  //}

};

export default plugin;

//userWithNullProfile(id: UUID!): UserProfile
const schema = buildSchema(`
  type Query {
    memberTypes: [MemberType]
    posts: [Post]
    users: [UserProfile]
    profiles: [ProfileMemberType]

    memberType(id: MemberTypeId!): MemberType
    post(id: UUID!): Post
    user(id: UUID!): UserProfile
    profile(id: UUID!): ProfileMemberType

  }

  type MemberType {
    id: MemberTypeId!
    discount: Float
    postsLimitPerMonth: Int
  }

  type Post {
    id: UUID!
    title: String
    content: String
  }

  type User {
    id: UUID!
    name: String
    balance: Float
  }

  type Profile {
    id: UUID!
    isMale: Boolean
    yearOfBirth: Int
  }

  type UserProfile {
    id: UUID
    name: String
    balance: Float
    profile: ProfileMemberType
    posts: [Post]
  }

  type ProfileMemberType {
    id: UUID!
    isMale: Boolean
    yearOfBirth: Int
    memberType: MemberType
  }

  enum MemberTypeId {
    basic
    business
  }

  scalar UUID
`);

//schema.getType('UUID');
