a = arduino();
for k = 1:3
    writeRGB(a, [0 40 0]);
    pause(0.5);
    writeRGB(a, [0 0 0]);
    pause(0.5);
end
fprintf('done\n');
