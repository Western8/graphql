export type TUser = {
  id: string;
  name: string;
  balance: number;
}

export interface IUserAll extends TUser  {
  userSubscribedTo?: TSub[],
  subscribedToUser?: TSub[],
  posts?: TPost[],
  profile?: TProfile | null,
}

export type TPost = {
  id: string;
  title?: String;
  content?: String;
}

export type TProfile = {
  id: string;
  isMale: boolean;
  yearOfBirth: number;
  memberType?: TMemberType;
  memberTypeId?: string;
  userId?: string;
}

export type TMemberType = {
  id: string;
  discount: number;
  postsLimitPerMonth: number;
}

export type TSub = {
  subscriberId: string;
  authorId: string;
  //subscriber: TUser;
  //author: TUser;
}
