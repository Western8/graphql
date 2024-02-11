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
      //console.log('зашли в handler graphql !!!!!!!')
      //console.log('req.body.variables ', req.body.variables);      
      const result = graphql({
        schema,
        source: req.body.query,
        variableValues: req.body.variables,
        rootValue: resolvers,
        contextValue: fastify,
        //typeResolver: typeResolvers,
      });
      return result;
    },
  });


  //const UUID = UUIDType;

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
      } else {
        return null;
      }
    },
    profile: async (args) => {
      const profile = await prisma.profile.findUnique({ where: { id: args.id } })
      if (profile) {
        return await getProfileData(profile);
      } else {
        return null;
      }
    },
  }

  const getUserData = async (user) => {
    const posts = await prisma.post.findMany({ where: { authorId: user.id } });
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    const profileData = await getProfileData(profile);

    const subs = await prisma.subscribersOnAuthors.findMany({ where: { subscriberId: user.id } })
    const userSubscribedTo = subs.map(async (item) => {
      const subTo = await prisma.user.findUnique({ where: { id: item.authorId } });
      if (!subTo) return {};
      const subsBack = await prisma.subscribersOnAuthors.findMany({ where: { authorId: subTo.id } })
      const subscribedToUser = subsBack.map(itemSubBack => { return  { id: itemSubBack.subscriberId }} );
      return {
        id: subTo.id,
        name: subTo.name,
        subscribedToUser,
      }
    })

    const subsBack = await prisma.subscribersOnAuthors.findMany({ where: { authorId: user.id } })
    const subscribedToUser = subsBack.map(async (item) => {
      const subBack = await prisma.user.findUnique({ where: { id: item.subscriberId } });
      if (!subBack) return {};
      const subsTo = await prisma.subscribersOnAuthors.findMany({ where: { subscriberId: subBack.id } })
      const userSubscribedTo = subsTo.map(itemSubTo => { return  { id: itemSubTo.authorId }} );
      return {
        id: subBack.id,
        name: subBack.name,
        userSubscribedTo,
      }
    })

    return {
      id: user.id,
      name: user.name,
      balance: user.balance,
      profile: profileData,
      posts,
      userSubscribedTo: userSubscribedTo,
      subscribedToUser: subscribedToUser,
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
    userSubscribedTo: [UserSubscribedTo]
    subscribedToUser: [SubscribedToUser]
  }

  type ProfileMemberType {
    id: UUID!
    isMale: Boolean
    yearOfBirth: Int
    memberType: MemberType
  }

  type UserSubscribedTo {
    id: UUID!
    name: String
    subscribedToUser: [SubscribedToUser]
  }

  type SubscribedToUser {
    id: UUID!
    name: String
    userSubscribedTo: [UserSubscribedTo]
  }

  enum MemberTypeId {
    basic
    business
  }

  scalar UUID
`);
