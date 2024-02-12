import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema, gqlSchema } from './schemas.js';
import { graphql, parse, validate } from 'graphql';
import depthLimit from 'graphql-depth-limit';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { prisma } = fastify;

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
      const errors = validate(gqlSchema, parse(req.body.query), [depthLimit(5)]);
      if (errors.length) return { errors }; 
      
      const result = graphql({
        schema: gqlSchema,
        source: req.body.query,
        variableValues: req.body.variables,
        rootValue: resolvers,
        contextValue: fastify,
        //typeResolver: typeResolvers,
      });
      return result;
    },
  });

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

    createUser: async (args) => {
      const user = await prisma.user.create({
        data: args.dto
      });
      return user;
    },
    createPost: async (args) => {
      const post = await prisma.post.create({
        data: args.dto
      });
      return post;
    },
    createProfile: async (args) => {
      const profile = await prisma.profile.create({
        data: args.dto
      });
      return profile;
    },

    deletePost: async (args) => {
      await prisma.post.delete({ where: { id: args.id } });
      return true;
    },
    deleteProfile: async (args) => {
      await prisma.profile.delete({ where: { id: args.id } });
      return true;
    },
    deleteUser: async (args) => {
      await prisma.user.delete({ where: { id: args.id } });
      return true;
    },

    changeUser: async (args) => {
      const user = await prisma.user.update({
        where: { id: args.id },
        data: args.dto,
      });
      return user;
    },
    changePost: async (args) => {
      const post = await prisma.post.update({
        where: { id: args.id },
        data: args.dto,
      });
      return post;
    },
    changeProfile: async (args) => {
      const profile = await prisma.profile.update({
        where: { id: args.id },
        data: args.dto,
      });
      return profile;
    },

    subscribeTo: async (args) => {
      const sub = await prisma.subscribersOnAuthors.create({
        data: {
          subscriberId: args.userId,
          authorId: args.authorId,
        }
      });
      return { id: args.authorId };
    },
    unsubscribeFrom: async (args) => {
      await prisma.subscribersOnAuthors.deleteMany({
        where: {
          subscriberId: args.userId,
          authorId: args.authorId,
        }
      });
      return true;
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
      const subscribedToUser = subsBack.map(itemSubBack => { return { id: itemSubBack.subscriberId } });
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
      const userSubscribedTo = subsTo.map(itemSubTo => { return { id: itemSubTo.authorId } });
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

  //const UUID = UUIDType;
  //const typeResolvers = {
  //  UUID: UUIDType,
  //}

};

export default plugin;