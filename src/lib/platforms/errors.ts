/** Erros das redes. `userMessage` é mostrado ao utilizador (pt-PT). */
abstract class PlatformError extends Error {
  readonly userMessage: string;
  constructor(message: string, userMessage?: string) {
    super(message);
    this.name = new.target.name;
    this.userMessage = userMessage ?? message;
  }
}

/** Falha temporária: tentar de novo mais tarde. */
export class TransientError extends PlatformError {}

/** Falha definitiva: não adianta tentar de novo. */
export class PermanentError extends PlatformError {}

/** Token inválido ou revogado: a conta tem de ser religada. */
export class AuthError extends PlatformError {}

/** Limite ou quota atingidos: adiar até `until`, sem contar como tentativa. */
export class DeferError extends PlatformError {
  constructor(
    message: string,
    public readonly until: Date,
    userMessage?: string,
  ) {
    super(message, userMessage);
  }
}
