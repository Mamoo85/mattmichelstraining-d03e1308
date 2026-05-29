const CheckEmailCard = ({ email }: { email?: string }) => (
  <div className="p-6 border rounded-lg text-center">
    <p className="text-lg font-semibold">Check your email</p>
    {email && <p className="text-muted-foreground text-sm mt-1">We sent a link to <strong>{email}</strong></p>}
  </div>
);
export default CheckEmailCard;
