import { Type } from '@fastify/type-provider-typebox';
import { buildSchema } from 'graphql';

export const gqlResponseSchema = Type.Partial(
  Type.Object({
    data: Type.Any(),
    errors: Type.Any(),
  }),
);

export const createGqlResponseSchema = {
  body: Type.Object(
    {
      query: Type.String(),
      variables: Type.Optional(Type.Record(Type.String(), Type.Any())),
    },
    {
      additionalProperties: false,
    },
  ),
};

export const gqlSchema = buildSchema(`
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

  type Mutation  {
    createUser(dto: CreateUserInput!): User
    createPost(dto: CreatePostInput!): Post
    createProfile(dto: CreateProfileInput!): Profile

    deletePost(id: UUID): Boolean
    deleteProfile(id: UUID): Boolean
    deleteUser(id: UUID): Boolean

    changeUser(id: UUID, dto: ChangeUserInput!): User
    changePost(id: UUID, dto: ChangePostInput!): Post
    changeProfile(id: UUID, dto: ChangeProfileInput!): Profile

    subscribeTo(userId: UUID, authorId: UUID): ObjID
    unsubscribeFrom(userId: UUID, authorId: UUID): Boolean
  }

  input CreateUserInput {
    name: String
    balance: Float
  }

  input CreatePostInput {
    authorId: UUID
    content: String
    title: String
  }

  input CreateProfileInput {
    userId: UUID
    memberTypeId: MemberTypeId
    isMale: Boolean
    yearOfBirth: Int
  }

  input ChangeUserInput {
    name: String
  }

  input ChangePostInput {
    title: String
  }

  input ChangeProfileInput {
    isMale: Boolean
  }

  type ObjID {
    id: UUID
  }
`);
