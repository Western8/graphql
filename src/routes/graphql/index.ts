import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema, gqlSchema } from './schemas.js';
import { graphql, parse, validate } from 'graphql';
import depthLimit from 'graphql-depth-limit';
import DataLoader from 'dataloader';

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

  type TUsers = { id: string; name: string; balance: number; }
  //const loaders: DataLoader<unknown, TUsers[]>[] = [];

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

  interface Sub {
    subscriberId: string | undefined;
    authorId: string | undefined;
  };

  const loaderSubsAll = new DataLoader(async (ids: readonly number[]) => {
    const subscribersOnAuthors = await prisma.subscribersOnAuthors.findMany();
    const subscribersOnAuthorsSorted = ids.map(id => subscribersOnAuthors);
    return subscribersOnAuthorsSorted;
  });

  const loaderUsersAll = new DataLoader(async (ids: readonly number[]) => {
    const users = await prisma.user.findMany();
    const usersSorted = ids.map(id => users);
    return usersSorted;
  });

  /*
  const loaderSubs = new DataLoader(async (ids: readonly Sub[]) => {
    //const idsSubscriber = ids.map(item => item.subscriberId);
    //const idsAuthor = ids.map(item => item.authorId);
    const subscribersOnAuthors = await prisma.subscribersOnAuthors.findMany();
    /*
    const subscribersOnAuthors = await prisma.subscribersOnAuthors.findMany({
      where: {
        OR: [
          { subscriberId: { in: idsSubscriber as string[] } },
          { authorId: { in: idsAuthor as string[] } },
        ]
      }
    });
    */
    //const subscribersOnAuthorsSorted = ids.map(id => subscribersOnAuthors);
    /*
     const subscribersOnAuthorsSorted = ids.map(id => subscribersOnAuthors.filter(item => {
       if (id.subscriberId) return item.subscriberId === id.subscriberId;
       if (id.authorId) return item.authorId === id.authorId;
       return true;
     }));
     */
   // return subscribersOnAuthorsSorted;
  //});
  /*
    const loaderSubsTo = new DataLoader(async (ids: readonly string[]) => {
      const subscribersOnAuthors = await prisma.subscribersOnAuthors.findMany({
        where: {
          subscriberId: { in: ids as string[] }
        }
      });
      const subscribersOnAuthorsSorted = ids.map(id => subscribersOnAuthors.filter(item => item.subscriberId === id));
      return subscribersOnAuthorsSorted;
    });
  
    const loaderSubsBack = new DataLoader(async (ids: readonly string[]) => {
      const subscribersOnAuthors = await prisma.subscribersOnAuthors.findMany({
        where: {
          authorId: { in: ids as string[] }
        }
      });
      const subscribersOnAuthorsSorted = ids.map(id => subscribersOnAuthors.filter(item => item.authorId === id));
      return subscribersOnAuthorsSorted;
    });
  */
  const resolvers = {
    memberTypes: async () => await prisma.memberType.findMany(),
    posts: async () => await prisma.post.findMany(),
    users: async () => {
      const users = await prisma.user.findMany();
      //const users = loaderUsers.loadMany();
      //return users.map(async (item) => await getUserData(item));
      /*
      if (!loaders[0]) {
        console.log('Зашли в loader!!!!!!!!!! ');
        const loader = new DataLoader(async ([k]) => {
          return [await prisma.user.findMany()];
        });
        loaders.push(loader);
        //loaders.loader = loader;
      }

      const users = await loaders[0].load(k);
      */
      return users.map(async (item, __, users) => await getUserData(item, users));
      //return users.map((item) => getUserData(item));
      //setTimeout(() => {}, 0);
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
      //const user = await prisma.user.findUnique({ where: { id: args.id } })
      const user = (await loaderUsers.load(args.id))[0];
      if (user) {
        return await getUserData(user);
        //return await getUserData(user, loaderPosts);
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

  let counter = 0;
  const getUserData = async (user, users: TUsers[] = []) => {
    const posts = await loaderPosts.load(user.id);
    //const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    const profiles = await loaderProfiles.load(user.id);
    const profile = profiles[0];
    const profileData = await getProfileData(profile);

    let usersAll = users;
    if (!users.length) {
      usersAll = await loaderUsersAll.load(counter);
    }
    counter++;
    const subsAll = await loaderSubsAll.load(counter);
    //const subsAll = await loaderSubsAll.load(user.id);


    const subs = await subsAll.filter(item => item.subscriberId === user.id );
    //console.log('1111111111 subsAll ', subsAll);
    //console.log('1111111111 subs ', subs);
    
    const userSubscribedTo = subs.map(async (item) => {
      //const subTo = await prisma.user.findUnique({ where: { id: item.authorId } });
      //const subTo = (await loaderUsers.load(item.authorId))[0];
      const subTo = usersAll.find(itemUsersAll => itemUsersAll.id === item.authorId );;
      if (!subTo) throw new Error('A нету юзера!!!!!!!!!!!!!!!!!');// return {};
      //const subsBack = await prisma.subscribersOnAuthors.findMany({ where: { authorId: subTo.id } });
      //const subsBack = await loaderSubsBack.load(subTo.id);
      const subsBack = subsAll.filter(item => item.authorId === subTo.id );
      const subscribedToUser = subsBack.map(itemSubBack => { return { id: itemSubBack.subscriberId } });
      return {
        id: subTo.id,
        name: subTo.name,
        subscribedToUser,
      }
    });


    const subsBack = await  subsAll.filter(item => item.authorId === user.id );
    const subscribedToUser = subsBack.map(async (item) => {
      //const subBack = await prisma.user.findUnique({ where: { id: item.subscriberId } });
      //const subBack = (await loaderUsers.load(item.subscriberId))[0];
      const subBack = usersAll.find(itemUsersAll => itemUsersAll.id === item.subscriberId );;
      if (!subBack) throw new Error('A нету юзера!!!!!!!!!!!!!!!!!');
      //if (!subBack) return {};
      //const subsTo = await prisma.subscribersOnAuthors.findMany({ where: { subscriberId: subBack.id } })
      //const subsTo = await loaderSubsTo.load(subBack.id);
      const subsTo = subsAll.filter(item => item.subscriberId === subBack.id );
      const userSubscribedTo = subsTo.map(itemSubTo => { return { id: itemSubTo.authorId } });
      return {
        id: subBack.id,
        name: subBack.name,
        userSubscribedTo,
      }
    })


    //loaderSubs.load({ subscriberId: user.id, authorId: undefined });
    //loaderSubs.load({ subscriberId: undefined, authorId: user.id });

    //const subs = await prisma.subscribersOnAuthors.findMany({ where: { subscriberId: user.id } })
    //const subs = await loaderSubsTo.load(user.id);
    /*
    const subs =  await    loaderSubs.load({ subscriberId: user.id, authorId: undefined });
    const userSubscribedTo = subs.map(async (item) => {
      //const subTo = await prisma.user.findUnique({ where: { id: item.authorId } });
      const subTo = (await loaderUsers.load(item.authorId))[0];
      if (!subTo) return {};
      //const subsBack = await prisma.subscribersOnAuthors.findMany({ where: { authorId: subTo.id } });
      //const subsBack = await loaderSubsBack.load(subTo.id);
      const subsBack =  await   loaderSubs.load({ subscriberId: undefined, authorId: subTo.id });
      const subscribedToUser = subsBack.map(itemSubBack => { return { id: itemSubBack.subscriberId } });
      return {
        id: subTo.id,
        name: subTo.name,
        subscribedToUser,
      }
    })
    */
    //const subsBack = await prisma.subscribersOnAuthors.findMany({ where: { authorId: user.id } });
    //const subsBack = await loaderSubsBack.load(user.id);
    /*
    const subsBack =    await  loaderSubs.load({ subscriberId: undefined, authorId: user.id });
     const subscribedToUser = subsBack.map(async (item) => {
       //const subBack = await prisma.user.findUnique({ where: { id: item.subscriberId } });
       const subBack = (await loaderUsers.load(item.subscriberId))[0];
       if (!subBack) return {};
       //const subsTo = await prisma.subscribersOnAuthors.findMany({ where: { subscriberId: subBack.id } })
       //const subsTo = await loaderSubsTo.load(subBack.id);
       const subsTo =    await   loaderSubs.load({ subscriberId: subBack.id, authorId: undefined });
       const userSubscribedTo = subsTo.map(itemSubTo => { return { id: itemSubTo.authorId } });
       return {
         id: subBack.id,
         name: subBack.name,
         userSubscribedTo,
       }
     })
     */

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

  /*
  const getUserData = async (user) => {
    //const posts = await prisma.post.findMany({ where: { authorId: user.id } });
    const posts = await loaderPosts.load(user.id);
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
*/
  const getProfileData = async (profile) => {
    if (profile) {
      //const memberType = await prisma.memberType.findUnique({ where: { id: profile.memberTypeId } })
      const memberType = (await loaderMemberTypes.load(profile.memberTypeId))[0];
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