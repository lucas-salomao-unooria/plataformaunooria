import { Global, Module } from "@nestjs/common";
import { ObjectStorageService } from "./object-storage.service";

/** Global como o AssetsModule: qualquer módulo com documento privado injeta. */
@Global()
@Module({ providers: [ObjectStorageService], exports: [ObjectStorageService] })
export class StorageModule {}
