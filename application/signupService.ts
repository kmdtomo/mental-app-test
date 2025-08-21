// import { PointAccount } from "@/domain/model/pointAccont";
// import { User } from "@/domain/model/user";
// import { AuthRepository } from "@/domain/repository/authRepository";
// import { PointAccountRepository } from "@/domain/repository/pointAccountRepository";
// import { TransactionManager } from "@/domain/repository/transactionManager";
// import { UserRepository } from "@/domain/repository/userRepository";

// type SignUpWithEmailParams = {
//   email: string;
//   password: string;
//   name: string;
// };

// type SignUpWithOauthParams = {
//   code: string;
// };

// export class SignupService {
//   constructor(
//     private readonly userRepo: UserRepository,
//     private readonly authRepo: AuthRepository,
//     private readonly pointAccountRepo: PointAccountRepository,
//     private readonly transactionManager: TransactionManager
//   ) {}
//   async signUpWithEmail({ email, password, name }: SignUpWithEmailParams) {
//     console.log("Starting signUpWithEmail");

//     try {
//       return await this.transactionManager.runInTransaction(async () => {
//         console.log("Inside transaction");

//         // メールアドレスの重複チェック
//         console.log("Checking for existing user");
//         const existingUser = await this.userRepo.findOrNullByEmail(email);

//         if (existingUser) {
//           throw new Error(`User with email ${email} already exists`);
//         }

//         // 認証ユーザーの作成
//         console.log("Creating auth user");
//         const authUser = await this.authRepo.signUpWithEmail({
//           email,
//           password,
//         });
//         console.log("Auth user created:", authUser.id);

//         // ユーザーの作成
//         console.log("Creating user");
//         const user = User.create({
//           id: authUser.id,
//           email: authUser.email,
//           name: name,
//         });

//         // ユーザーの保存
//         console.log("Saving user");
//         await this.userRepo.save(user);
//         console.log("User saved");

//         // ポイントアカウントの作成
//         console.log("Creating point account");
//         const pointAccount = PointAccount.create({
//           userId: user.id,
//           initialBalance: 0,
//         });

//         // ポイントアカウントの保存
//         console.log("Saving point account");
//         await this.pointAccountRepo.save(pointAccount);
//         console.log("Point account saved");

//         return { success: true };
//       });
//     } catch (error) {
//       console.error("Transaction failed:", error);
//       throw error;
//     }
//   }

//   async completeSignupWithOauth({ code }: SignUpWithOauthParams) {
//     console.log("Starting completeSignupWithOauth");

//     try {
//       return await this.transactionManager.runInTransaction(async () => {
//         console.log("Inside transaction");

//         // 認証コードの交換
//         console.log("Exchanging code for session");
//         const authUser = await this.authRepo.exchangeCodeForSession(code);
//         console.log("Auth user retrieved:", authUser.id);

//         // ユーザーの作成
//         console.log("Creating user");
//         const user = User.create({
//           id: authUser.id,
//           email: authUser.email,
//           name: authUser.email,
//         });

//         // ユーザーの保存
//         console.log("Saving user");
//         await this.userRepo.save(user);
//         console.log("User saved");

//         // ポイントアカウントの作成
//         console.log("Creating point account");
//         const pointAccount = PointAccount.create({
//           userId: user.id,
//           initialBalance: 0,
//         });

//         // ポイントアカウントの保存
//         console.log("Saving point account");
//         await this.pointAccountRepo.save(pointAccount);
//         console.log("Point account saved");

//         return { success: true };
//       });
//     } catch (error) {
//       console.error("Transaction failed:", error);
//       throw error;
//     }
//   }
// }
