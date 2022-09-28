import { Resolver, Query } from '@nestjs/graphql';

@Resolver()
export class AppResolver {
  @Query(() => String, { nullable: true })
  async hello(): Promise<string> {
    return 'Hi!';
  }
}
