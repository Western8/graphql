import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema, gqlSchema } from './schemas.js';
import { graphql, parse, validate } from 'graphql';
import depthLimit from 'graphql-depth-limit';
import DataLoader from 'dataloader';
import { IUserAll, TMemberType } from './types/types.js';

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
      const errors = validate(gqlSchema, parse(req.body.query), [depthLimit(5)]);
      if (errors.length) return { errors };

      const resolvers = getResolvers(req.body.query);

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

  const loaderUsers = new DataLoader(async (ids: readonly string[]) => {
    const users = await prisma.user.findMany({
      where: {
        id: { in: ids as string[] }
      }
    });
    const usersSorted = ids.map(id => users.filter(item => item.id === id));
    return usersSorted;
  });

  const loaderProfiles = new DataLoader(async (ids: readonly string[]) => {
    const profiles = await prisma.profile.findMany({
      where: {
        userId: { in: ids as string[] }
      }
    });
    const profilesSorted = ids.map(id => profiles.filter(item => item.userId === id));
    return profilesSorted;
  });

  const loaderPosts = new DataLoader(async (ids: readonly string[]) => {
    const posts = await prisma.post.findMany({
      where: {
        authorId: { in: ids as string[] }
      }
    });
    const postsSorted = ids.map(id => posts.filter(item => item.authorId === id));
    return postsSorted;
  });

  const loaderMemberTypes = new DataLoader(async (ids: readonly string[]) => {
    const memberTypes = await prisma.memberType.findMany({
      where: {
        id: { in: ids as string[] }
      }
    });
    const memberTypesSorted = ids.map(id => memberTypes.filter(item => item.id === id));
    return memberTypesSorted;
  });

  const loaderSubsAll = new DataLoader(async (ids: readonly number[]) => {
    const subscribersOnAuthors = await prisma.subscribersOnAuthors.findMany();
    const subscribersOnAuthorsSorted = ids.map(id => subscribersOnAuthors);
    return subscribersOnAuthorsSorted;
  });

  const loaderUsersAll = new DataLoader(async (ids: readonly number[]) => {
    const users = await prisma.user.findMany({
      include: {
        posts: true,
        profile: {
          include: {
            memberType: true,
          }
        },
        userSubscribedTo: true,
        subscribedToUser: true,
      }
    });

    const usersSorted = ids.map(id => users);
    return usersSorted;
  });

  function getResolvers(query) {
    const resolvers = {
      memberTypes: async () => await prisma.memberType.findMany(),
      posts: async () => await prisma.post.findMany(),
      users: async () => {
        const hasSubscribedToUser = query.includes('subscribedToUser');
        const hasPostProfile = query.includes('post') || query.includes('profile');
        const params = {
          include: {
            posts: true,
            profile: {
              include: {
                memberType: true,
              }
            },
            userSubscribedTo: true,
            subscribedToUser: hasSubscribedToUser,
          }
        };
        const users = await prisma.user.findMany(params);

        return users.map(async (item, __, users) => await getUserData(item, users, hasPostProfile));
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
        const user = (await loaderUsers.load(args.id))[0];
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
    return resolvers;
  }

  let counter = 0;
  const getUserData = async (user, users: IUserAll[] = [], hasPostProfile = false) => {
    counter++;
    let usersAll = users;
    let subsAll;
    if (!users.length) {
      usersAll = await loaderUsersAll.load(counter);
      subsAll = await loaderSubsAll.load(counter);
    }
    const userPrime = usersAll.find(item => item.id === user.id);

    const userSubscribedTo = userPrime?.userSubscribedTo?.map(item => {
      const subTo = usersAll.find(itemUsersAll => itemUsersAll.id === item.authorId);
      let subscribedToUser = subTo?.subscribedToUser;
      if (!users.length) {
        const subsBack = subsAll.filter(item => item.authorId === subTo?.id);
        subscribedToUser = subsBack.map(itemSubBack => { return { id: itemSubBack.subscriberId } });
      }
      return {
        id: item.authorId,
        name: subTo?.name,//item.author.name,
        subscribedToUser: subscribedToUser,
      }
    }) || [];
    const subscribedToUser = userPrime?.subscribedToUser?.map(item => {
      const subBack = usersAll.find(itemUsersAll => itemUsersAll.id === item.subscriberId);
      let userSubscribedTo = subBack?.userSubscribedTo;
      if (!users.length) {
        const subsTo = subsAll.filter(item => item.subscriberId === subBack?.id);
        userSubscribedTo = subsTo.map(itemSubTo => { return { id: itemSubTo.authorId } });
      }
      return {
        id: item.subscriberId,
        name: subBack?.name,//item.subscriber.name,
        userSubscribedTo: userSubscribedTo,
      }
    }) || [];

    let posts = userPrime?.posts;
    let profile = userPrime?.profile;
    if (hasPostProfile) {
      posts = await loaderPosts.load(user.id);
      const profiles = await loaderProfiles.load(user.id);
      profile = profiles[0];
    }
    const profileData = await getProfileData(profile, profile?.memberType);

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

  const getProfileData = async (profile, memberType: TMemberType | null = null) => {
    if (profile) {
      if (memberType === null) {
        memberType = (await loaderMemberTypes.load(profile.memberTypeId))[0];
      }
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
  
};

export default plugin;